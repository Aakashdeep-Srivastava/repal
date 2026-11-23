import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isMarketplaceEnabled,
  buildMarketplaceOrderBody,
  createMarketplaceOrder,
  payeeMerchantIdFor,
  type MarketplaceUnit,
} from "@/lib/paypal/marketplace";
import { approvalUrlOf } from "@/lib/paypal/orders";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/marketplace/order — Phase 5: a SINGLE buyer approval settling
 * across MULTIPLE sellers (one purchase_unit + payee per merchant).
 *
 * ⚠️ Gated OFF by default. A live multiparty order needs PayPal **marketplace
 * partner approval** + onboarded sellers. Until `PAYPAL_MARKETPLACE_ENABLED=1`
 * (and approval is in place), this route does NOT call PayPal — it returns 501
 * with the exact request it WOULD send, so the structure is demonstrable and
 * honest. The live path today is per-merchant routing (Phase 2): one separate
 * single-seller order + capture per merchant (`/api/pay/order`). See
 * docs/PRODUCT_SCOPE.md Phase 5.
 */

/** The app's public origin (CloudFront/custom domain), NOT the internal host. */
function publicBase(req: Request): string {
  const r = process.env.PAYPAL_OIDC_REDIRECT;
  return r ? new URL(r).origin : new URL(req.url).origin;
}

const Unit = z.object({
  merchantId: z.string().min(1).max(64),
  amountUsd: z.number().positive(),
  description: z.string().max(200).optional(),
  platformFeeUsd: z.number().nonnegative().optional(),
  referenceId: z.string().min(1).max(64).optional(),
});

const Body = z.object({
  units: z.array(Unit).min(1).max(10),
  disbursementMode: z.enum(["INSTANT", "DELAYED"]).optional(),
});

export async function POST(req: Request) {
  // Money op — guard against runaway/abuse (same budget as /api/pay/order).
  const rl = rateLimit(clientKey(req, "pay-marketplace"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: rateLimitHeaders(rl) });
  }

  const origin = publicBase(req);
  const urls = {
    returnUrl: `${origin}/checkout?paypal=return`,
    cancelUrl: `${origin}/checkout?paypal=cancel`,
  };
  const units: MarketplaceUnit[] = parsed.data.units;

  // Which sellers are missing a payee merchant id — a real marketplace order needs
  // one per seller (set via onboarding). Reported so the gap is explicit, never silent.
  const unmappedSellers = units
    .map((u) => u.merchantId)
    .filter((mid) => !payeeMerchantIdFor(mid));

  // ── Gated OFF (default): no PayPal call. Return the exact request we WOULD send. ──
  if (!isMarketplaceEnabled()) {
    return NextResponse.json(
      {
        enabled: false,
        reason:
          "Single-checkout multi-seller marketplace requires PayPal marketplace partner " +
          "approval (Phase 5) and is not enabled. The live path is per-merchant routing " +
          "(Phase 2) — one separate single-seller order + capture per merchant via /api/pay/order.",
        unmappedSellers,
        // Honest demonstration of the built structure (no secrets — payee ids are
        // onboarded account ids, not credentials).
        requestPreview: buildMarketplaceOrderBody({ units, ...urls, disbursementMode: parsed.data.disbursementMode }),
      },
      { status: 501, headers: rateLimitHeaders(rl) },
    );
  }

  // ── Enabled (approval in place): create the real multiparty order. ──
  try {
    const order = await createMarketplaceOrder({ units, ...urls, disbursementMode: parsed.data.disbursementMode });
    return NextResponse.json({
      enabled: true,
      ...order,
      approveUrl: approvalUrlOf(order),
      sellers: units.map((u) => ({ merchantId: u.merchantId, amountUsd: u.amountUsd })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "marketplace order failed" },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }
}
