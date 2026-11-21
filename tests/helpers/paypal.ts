/**
 * PayPal sandbox test helpers (spec §5).
 *
 * Thin wrappers over the app's own lib/paypal adapters so tests exercise the
 * SAME code path the app uses. Order creation + capture run against the real
 * PayPal SANDBOX. Buyer approval happens on PayPal's hosted page (driven by the
 * browser agent) — it cannot be scripted purely server-side.
 *
 * HONESTY RULE (spec §5): never claim a simulated payout is a real transfer.
 * When the sandbox sender account is restricted (the current India business
 * account can't send Payouts — see docs/PAYPAL_SANDBOX.md), lib/payout/liberate
 * degrades to a clearly-labelled SIMULATED payout; tests must assert that label,
 * not treat it as settled money.
 */
import { createOrder, captureOrder, approvalUrlOf, type PayPalOrder } from "../../lib/paypal/orders";

export interface TestOrder {
  order: PayPalOrder;
  orderId: string;
  approveUrl: string | undefined;
}

/** Create a buyer-present sandbox order for a dollar amount. */
export async function createSandboxOrder(amountUsd: number, description = "QA test order"): Promise<TestOrder> {
  const order = await createOrder({ amountUsd, description });
  return { order, orderId: order.id, approveUrl: approvalUrlOf(order) };
}

/** Capture an approved order. The caller must have driven buyer approval first. */
export async function captureSandboxOrder(orderId: string) {
  return captureOrder(orderId);
}

/** True when PayPal REST credentials are present (else integration tests skip). */
export function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/**
 * Pull the first capture id + status out of an Orders v2 capture response.
 * Mirrors the app's defensive reader and additionally surfaces the per-unit
 * STATUS so a test can detect PARTIALLY_COMPLETED / DECLINED instead of
 * assuming success (the known capture[0] assumption the review flagged).
 */
export function readCapture(result: unknown): { captureId?: string; status?: string; unitCount: number } {
  const r = result as {
    status?: string;
    purchase_units?: { payments?: { captures?: { id?: string; status?: string }[] } }[];
  };
  const units = r?.purchase_units ?? [];
  const cap = units[0]?.payments?.captures?.[0];
  return { captureId: cap?.id, status: cap?.status ?? r?.status, unitCount: units.length };
}
