/**
 * Trusted merchant → PayPal seller registry (Phase 2 — per-merchant routing).
 *
 * RePal routes each product's checkout to the SELLER that owns it. A session may
 * touch several merchants, each with its own PayPal app credentials, token cache and
 * webhook id — but every PayPal transaction is still a SEPARATE order + approval +
 * capture under one seller. This is NOT a single cross-seller marketplace transaction
 * (that is Phase 5, gated on PayPal partner approval).
 *
 * CREDENTIAL SOURCE — env only, resolved server-side, never sent to the client and
 * never logged:
 *   - Default/platform seller: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID
 *     (merchantId = PAYPAL_DEFAULT_MERCHANT_ID, else "default").
 *   - A dedicated seller for merchant <mid>: PAYPAL_CLIENT_ID__<MID> /
 *     PAYPAL_CLIENT_SECRET__<MID> / PAYPAL_WEBHOOK_ID__<MID>, where <MID> is the
 *     merchant slug upper-cased with every non-alphanumeric char turned into "_".
 *
 * A merchant with no dedicated app falls back to the platform seller (failure
 * isolation + graceful degradation) — resolution reports which happened so callers
 * never mistake a fallback for a dedicated seller.
 */
import type { SellerCredentials } from "@/lib/paypal/client";

export interface MerchantSeller {
  /** The merchant slug this seller serves, or the default-seller sentinel. */
  merchantId: string;
  credentials: SellerCredentials;
  /** PayPal webhook id for this seller's app, if configured. */
  webhookId?: string;
  /** False when we fell back to the platform seller because the merchant has no app. */
  dedicated: boolean;
}

export function defaultMerchantId(): string {
  return process.env.PAYPAL_DEFAULT_MERCHANT_ID || "default";
}

/** Env-key-safe form of a merchant slug: UPPER, non-alphanumerics → "_". */
export function envSuffix(merchantId: string): string {
  return merchantId.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function platformCreds(): SellerCredentials | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** The dedicated seller for a merchant, or null if it has no dedicated app wired. */
function dedicatedSeller(merchantId: string): MerchantSeller | null {
  const s = envSuffix(merchantId);
  if (!s) return null;
  const clientId = process.env[`PAYPAL_CLIENT_ID__${s}`];
  const clientSecret = process.env[`PAYPAL_CLIENT_SECRET__${s}`];
  if (!clientId || !clientSecret) return null;
  return {
    merchantId,
    credentials: { clientId, clientSecret },
    webhookId: process.env[`PAYPAL_WEBHOOK_ID__${s}`],
    dedicated: true,
  };
}

/**
 * Resolve which PayPal seller should handle a merchant's checkout.
 *  - a dedicated app for that merchant, if one is configured;
 *  - else the platform seller (dedicated: false);
 * Throws only when NO seller is configured at all (platform creds missing).
 */
export function resolveSeller(merchantId?: string | null): MerchantSeller {
  const mid = (merchantId && merchantId.trim()) || defaultMerchantId();

  if (merchantId && mid !== defaultMerchantId()) {
    const dedicated = dedicatedSeller(mid);
    if (dedicated) return dedicated;
  }

  const platform = platformCreds();
  if (!platform) {
    throw new Error(
      `No PayPal seller configured for merchant "${mid}": set PAYPAL_CLIENT_ID/SECRET ` +
        `(platform seller) or PAYPAL_CLIENT_ID__${envSuffix(mid)} (dedicated).`,
    );
  }
  return {
    merchantId: defaultMerchantId(),
    credentials: platform,
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
    dedicated: false,
  };
}

/** True when a merchant has its own dedicated PayPal app (not the platform fallback). */
export function hasDedicatedSeller(merchantId: string): boolean {
  return dedicatedSeller(merchantId) != null;
}

/**
 * Diagnostics — which sellers are wired, WITHOUT exposing any secret. Returns the
 * platform seller plus every merchant that has a dedicated app (discovered from the
 * PAYPAL_CLIENT_ID__<MID> env keys present).
 */
export function listConfiguredSellers(): { merchantId: string; dedicated: boolean; webhookConfigured: boolean }[] {
  const out: { merchantId: string; dedicated: boolean; webhookConfigured: boolean }[] = [];
  if (platformCreds()) {
    out.push({ merchantId: defaultMerchantId(), dedicated: false, webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID) });
  }
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^PAYPAL_CLIENT_ID__(.+)$/);
    if (!m || !process.env[`PAYPAL_CLIENT_SECRET__${m[1]}`]) continue;
    out.push({ merchantId: m[1], dedicated: true, webhookConfigured: Boolean(process.env[`PAYPAL_WEBHOOK_ID__${m[1]}`]) });
  }
  return out;
}
