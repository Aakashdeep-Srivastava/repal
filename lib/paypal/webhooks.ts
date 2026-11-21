import { paypalRequest, type SellerCredentials } from "@/lib/paypal/client";
import { resolveSeller } from "@/lib/paypal/merchants";

/**
 * Webhook signature verification. Every inbound webhook is verified against
 * PayPal before we trust it. See docs/TECH_PRD.md §4.
 * OWNER: Aakash.
 */

export interface WebhookHeaders {
  authAlgo: string; // PAYPAL-AUTH-ALGO
  certUrl: string; // PAYPAL-CERT-URL
  transmissionId: string; // PAYPAL-TRANSMISSION-ID
  transmissionSig: string; // PAYPAL-TRANSMISSION-SIG
  transmissionTime: string; // PAYPAL-TRANSMISSION-TIME
}

/**
 * Returns true iff PayPal confirms the webhook signature is valid. The verify call
 * must run under the SAME seller app that owns `webhookId`; pass that seller's `creds`
 * (Phase 2). Omit `creds` for the platform seller (single-seller default).
 */
export async function verifyWebhookSignature(
  headers: WebhookHeaders,
  rawBody: string,
  webhookId: string,
  creds?: SellerCredentials,
): Promise<boolean> {
  const res = await paypalRequest<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      creds,
      body: {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        // webhook_event must be the parsed JSON of the exact raw body.
        webhook_event: JSON.parse(rawBody),
      },
    },
  );
  return res.verification_status === "SUCCESS";
}

/**
 * Multi-seller webhook verification. An inbound PayPal webhook doesn't name which of
 * our seller apps sent it, so try each configured seller's (webhookId, creds) until
 * one verifies. Returns the verifying merchantId, or null if none do. With only the
 * platform seller wired this is exactly the single-seller check.
 */
export async function verifyWebhookForAnySeller(
  headers: WebhookHeaders,
  rawBody: string,
  merchantIds: string[],
): Promise<{ verified: boolean; merchantId: string | null }> {
  // De-dupe sellers by clientId so we don't verify the same app twice.
  const seen = new Set<string>();
  for (const mid of merchantIds) {
    let seller;
    try {
      seller = resolveSeller(mid);
    } catch {
      continue;
    }
    if (!seller.webhookId || seen.has(seller.credentials.clientId)) continue;
    seen.add(seller.credentials.clientId);
    try {
      if (await verifyWebhookSignature(headers, rawBody, seller.webhookId, seller.credentials)) {
        return { verified: true, merchantId: seller.merchantId };
      }
    } catch {
      // One seller's verify failing must not block the others (failure isolation).
    }
  }
  return { verified: false, merchantId: null };
}
