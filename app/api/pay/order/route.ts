import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, approvalUrlOf } from "@/lib/paypal/orders";
import { resolveSeller } from "@/lib/paypal/merchants";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/order — create an Orders v2 order (pay-in).
 *
 * Buyer-present (no `vaultId`): the order is created with return/cancel URLs
 * pointing back at /checkout, and the response includes `approveUrl` — the
 * PayPal page the buyer must approve on BEFORE /api/pay/capture can succeed.
 * The URLs are built server-side from the app's PUBLIC base (never taken from
 * the client) so the route can't be used as an open redirect.
 *
 * Why not `req.url`: behind CloudFront → ALB → ECS the request host is the
 * internal instance hostname (e.g. ip-10-x.compute.internal:8080), so a return
 * URL built from it sends the buyer's browser to an address only reachable
 * inside AWS (DNS_PROBE_FINISHED_NXDOMAIN). We derive the public origin from
 * PAYPAL_OIDC_REDIRECT (the registered public callback) instead — the same
 * fix the login callback and the mandates routes already use.
 *
 * Agent-initiated (`vaultId`): pays with the stored Vault token, no redirect.
 */

/** The app's public origin (CloudFront), NOT the internal request host. */
function publicBase(req: Request): string {
  const r = process.env.PAYPAL_OIDC_REDIRECT;
  return r ? new URL(r).origin : new URL(req.url).origin;
}
const Body = z.object({
  amountUsd: z.number().positive(),
  description: z.string().optional(),
  vaultId: z.string().optional(), // agent-initiated, no redirect
  // The agent's chosen funding method (lib/paypal/funding). Selects the Orders
  // v2 payment_source on the buyer-present path. Defaults to standard PayPal.
  funding: z.enum(["paypal", "pay_later", "venmo"]).optional(),
  // Phase 2 — route this order to the seller that owns the product's merchant.
  // Omit to use the platform seller (single-seller default). The client MUST echo
  // the returned `merchantId` to /api/pay/capture so the capture hits the same seller.
  merchantId: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request) {
  // Money op — create PayPal order. Guard against runaway/abuse.
  const rl = rateLimit(clientKey(req, "pay-order"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const origin = publicBase(req);
  const urls = {
    returnUrl: `${origin}/checkout?paypal=return`,
    cancelUrl: `${origin}/checkout?paypal=cancel`,
  };

  // Phase 2 — resolve which seller handles this merchant's checkout (its own app
  // if configured, else the platform seller). `seller.merchantId` is echoed back so
  // the client sends the matching merchantId to capture.
  let seller;
  try {
    seller = resolveSeller(parsed.data.merchantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "no seller configured" },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }
  const sellerInfo = { merchantId: seller.merchantId, dedicatedSeller: seller.dedicated };

  try {
    const order = await createOrder({ ...parsed.data, ...urls }, seller.credentials);
    return NextResponse.json({ ...order, approveUrl: approvalUrlOf(order), ...sellerInfo });
  } catch (err) {
    // Resilience: a non-default funding method (e.g. Venmo, which is US-only and
    // needs an eligible buyer) can be unavailable in sandbox and fail order
    // creation. Rather than break the checkout, fall back once to standard
    // PayPal so the purchase can still complete.
    if (parsed.data.funding && parsed.data.funding !== "paypal") {
      try {
        const order = await createOrder({ ...parsed.data, funding: "paypal", ...urls }, seller.credentials);
        return NextResponse.json({ ...order, approveUrl: approvalUrlOf(order), fundingFellBack: true, ...sellerInfo });
      } catch {
        /* fall through to the error below */
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "order failed" },
      { status: 502 },
    );
  }
}
