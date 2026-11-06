import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, approvalUrlOf } from "@/lib/paypal/orders";

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
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  try {
    const order = await createOrder({
      ...parsed.data,
      returnUrl: `${origin}/checkout?paypal=return`,
      cancelUrl: `${origin}/checkout?paypal=cancel`,
    });
    return NextResponse.json({ ...order, approveUrl: approvalUrlOf(order) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "order failed" },
      { status: 502 },
    );
  }
}
