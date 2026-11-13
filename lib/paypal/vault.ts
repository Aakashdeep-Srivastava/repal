import { paypalRequest, newRequestId } from "@/lib/paypal/client";

/**
 * Vault v3 adapter — the mandate's delegated authority.
 *
 * Flow: create a setup token → buyer approves (approve link) → exchange it for a
 * payment token. That payment token id IS the agent's scoped authority, stored
 * on the Mandate as `paypalVaultTokenId`. See docs/TECH_PRD.md §4.
 * OWNER: Aakash.
 */

export interface SetupToken {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
}

export interface PaymentToken {
  id: string;
  status: string;
}

/** Create a Vault setup token for the PayPal payment source (buyer approves). */
export async function createSetupToken(returnUrl: string, cancelUrl: string): Promise<SetupToken> {
  return paypalRequest<SetupToken>("/v3/vault/setup-tokens", {
    method: "POST",
    requestId: newRequestId(),
    body: {
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          experience_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  });
}

/** Funding detail PayPal returns for a stored payment token. Note: for a
 * PayPal-wallet token PayPal exposes the payer's PayPal account (email), NOT the
 * underlying card/bank — merchants never see a buyer's funding instruments. */
export interface VaultTokenDetail {
  id: string;
  status: string;
  payment_source?: {
    paypal?: { email_address?: string; account_id?: string; name?: { given_name?: string; surname?: string } };
    card?: { brand?: string; last_digits?: string; expiry?: string };
  };
}

/** Read a stored payment (vault) token — the funding the buyer authorized. */
export async function getPaymentToken(id: string): Promise<VaultTokenDetail> {
  return paypalRequest<VaultTokenDetail>(`/v3/vault/payment-tokens/${encodeURIComponent(id)}`, {
    method: "GET",
    requestId: newRequestId(),
  });
}

/** Exchange an approved setup token for a durable payment (vault) token. */
export async function createPaymentToken(setupTokenId: string): Promise<PaymentToken> {
  return paypalRequest<PaymentToken>("/v3/vault/payment-tokens", {
    method: "POST",
    requestId: newRequestId(),
    body: { payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } } },
  });
}
