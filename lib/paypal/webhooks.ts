import { paypalRequest } from "@/lib/paypal/client";

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

/** Returns true iff PayPal confirms the webhook signature is valid. */
export async function verifyWebhookSignature(
  headers: WebhookHeaders,
  rawBody: string,
  webhookId: string,
): Promise<boolean> {
  const res = await paypalRequest<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
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
