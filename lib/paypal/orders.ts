import { paypalRequest, newRequestId } from "@/lib/paypal/client";

/**
 * Orders v2 adapter — pay-in. See docs/TECH_PRD.md §4.
 * OWNER: Aakash.
 */

export interface CreateOrderInput {
  amountUsd: number;
  description?: string;
  /** For agent-initiated (no-redirect) capture via a stored Vault token. */
  vaultId?: string;
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
  }

  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body,
    requestId: newRequestId(),
  });
}

/** Capture a previously created/approved order. */
export async function captureOrder(orderId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    requestId: newRequestId(),
  });
}
