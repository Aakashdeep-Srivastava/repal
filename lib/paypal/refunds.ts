import { paypalRequest, newRequestId } from "@/lib/paypal/client";

/**
 * Refunds adapter — reversal. See docs/TECH_PRD.md §4.
 * OWNER: Aakash.
 */

export interface RefundResult {
  id: string;
  status: string;
}

/** Refund a capture. Omit amountUsd for a full refund. */
export async function refundCapture(
  captureId: string,
  amountUsd?: number,
): Promise<RefundResult> {
  return paypalRequest<RefundResult>(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    requestId: newRequestId(),
    body:
      amountUsd !== undefined
        ? { amount: { value: amountUsd.toFixed(2), currency_code: "USD" } }
        : {},
  });
}
