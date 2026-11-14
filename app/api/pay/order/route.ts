import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, approvalUrlOf } from "@/lib/paypal/orders";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/order — create an Orders v2 order (pay-in).
 *
 * Buyer-present (no `vaultId`): the order is created with return/cancel URLs
 * pointing back at /checkout, and the response includes `approveUrl` — the
 * PayPal page the buyer must approve on BEFORE /api/pay/capture can succeed.
 * The URLs are built server-side from this request's origin (never taken from
 * the client) so the route can't be used as an open redirect.
 *
 * Agent-initiated (`vaultId`): pays with the stored Vault token, no redirect.
 */
const Body = z.object({
  amountUsd: z.number().positive(),
  description: z.string().optional(),
  vaultId: z.string().optional(), // agent-initiated, no redirect
  // The agent's chosen funding method (lib/paypal/funding). Selects the Orders
  // v2 payment_source on the buyer-present path. Defaults to standard PayPal.
  funding: z.enum(["paypal", "pay_later", "venmo"]).optional(),
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
  const origin = new URL(req.url).origin;
  const urls = {
    returnUrl: `${origin}/checkout?paypal=return`,
    cancelUrl: `${origin}/checkout?paypal=cancel`,
  };
  try {
    const order = await createOrder({ ...parsed.data, ...urls });
    return NextResponse.json({ ...order, approveUrl: approvalUrlOf(order) });
  } catch (err) {
    // Resilience: a non-default funding method (e.g. Venmo, which is US-only and
    // needs an eligible buyer) can be unavailable in sandbox and fail order
    // creation. Rather than break the checkout, fall back once to standard
    // PayPal so the purchase can still complete.
    if (parsed.data.funding && parsed.data.funding !== "paypal") {
      try {
        const order = await createOrder({ ...parsed.data, funding: "paypal", ...urls });
        return NextResponse.json({ ...order, approveUrl: approvalUrlOf(order), fundingFellBack: true });
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
