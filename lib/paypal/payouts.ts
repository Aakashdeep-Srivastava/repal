import { paypalRequest, newRequestId } from "@/lib/paypal/client";

/**
 * Payouts adapter — REWARD LIBERATION.
 *
 * Cashes unused/expiring reward value out to the user's PayPal balance. This is
 * the beat that turns stuck rewards into real (sandbox) money. See TECH_PRD §4.
 * OWNER: Aakash.
 */

export interface PayoutResult {
  batch_header: { payout_batch_id: string; batch_status: string };
}

export interface CreatePayoutInput {
  receiverEmail: string; // sandbox personal account email
  amountUsd: number;
  note?: string;
}

export async function createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
  const requestId = newRequestId();
  return paypalRequest<PayoutResult>("/v1/payments/payouts", {
    method: "POST",
    requestId,
    body: {
      sender_batch_header: {
        sender_batch_id: requestId,
        email_subject: "You have a payout from RePal",
        email_message: input.note ?? "Your liberated reward value.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: input.amountUsd.toFixed(2), currency: "USD" },
          receiver: input.receiverEmail,
          note: input.note ?? "RePal reward liberation",
          sender_item_id: requestId,
        },
      ],
    },
  });
}
