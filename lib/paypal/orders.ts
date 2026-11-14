import { paypalRequest, newRequestId } from "@/lib/paypal/client";
import type { FundingSource } from "@/lib/paypal/funding";

/**
 * Orders v2 adapter — pay-in. See docs/TECH_PRD.md §4.
 * OWNER: Aakash.
 */

export interface CreateOrderInput {
  amountUsd: number;
  description?: string;
  /** For agent-initiated (no-redirect) capture via a stored Vault token. */
  vaultId?: string;
  /**
   * Buyer-present checkout: where PayPal sends the buyer after they approve
   * (`returnUrl`) or cancel (`cancelUrl`). PayPal appends `?token=<orderId>`.
   * Ignored when `vaultId` is set (that path needs no buyer redirect).
   */
  returnUrl?: string;
  cancelUrl?: string;
  /**
   * Which funding method the agent picked (see lib/paypal/funding). Selects the
   * Orders v2 `payment_source`: `venmo` → a dedicated Venmo source; `paypal` and
   * `pay_later` → the PayPal wallet (Pay Later presented when eligible). Only
   * meaningful on the buyer-present path; ignored when `vaultId` is set.
   * Defaults to `paypal`.
   */
  funding?: FundingSource;
}

export interface PayPalOrder {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
}

/** Create an Orders v2 order (intent CAPTURE), USD. */
export async function createOrder(input: CreateOrderInput): Promise<PayPalOrder> {
  const body: Record<string, unknown> = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: { currency_code: "USD", value: input.amountUsd.toFixed(2) },
        description: input.description,
      },
    ],
  };

  // Agent-initiated path: pay with a stored vault token, no buyer redirect.
  if (input.vaultId) {
    body.payment_source = { paypal: { vault_id: input.vaultId } };
  } else if (input.returnUrl && input.cancelUrl) {
    // Buyer-present path: the order must be approved on PayPal before capture.
    // The response carries a `payer-action` link to send the buyer to. The
    // agent's chosen funding method selects which payment_source we open — Venmo
    // gets its own wallet; `paypal`/`pay_later` both open the PayPal wallet (the
    // approval page presents Pay Later / Pay-in-4 when the buyer is eligible).
    const experience_context = {
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
    };
    body.payment_source =
      input.funding === "venmo"
        ? { venmo: { experience_context } }
        : { paypal: { experience_context } };
  }

  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body,
    requestId: newRequestId(),
  });
}

/**
 * The URL the buyer must visit to approve the order — `payer-action` when the
 * order was created with an experience_context, `approve` otherwise.
 */
export function approvalUrlOf(order: PayPalOrder): string | undefined {
  const links = order.links ?? [];
  return (links.find((l) => l.rel === "payer-action") ?? links.find((l) => l.rel === "approve"))?.href;
}

/** Capture a previously created/approved order. */
export async function captureOrder(orderId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    requestId: newRequestId(),
  });
}
