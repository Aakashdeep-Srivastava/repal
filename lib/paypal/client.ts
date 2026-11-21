import { randomUUID } from "node:crypto";

/**
 * PayPal REST client — thin adapter (OAuth + PayPal-Request-Id).
 *
 * Reads credentials from env (see .env.local / .env.example). Sandbox only for
 * the hackathon (DEMO_MODE). See docs/TECH_PRD.md §4 and docs/PAYPAL_SETUP.md.
 *
 * OWNER: Aakash.
 */

const ENV = (process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase();

export const PAYPAL_BASE =
  ENV === "LIVE" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

/** One PayPal seller's app credentials (Phase 2 — per-merchant routing). */
export interface SellerCredentials {
  clientId: string;
  clientSecret: string;
}

function requireCreds(): SellerCredentials {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. " +
        "Copy .env.example → .env.local and fill your sandbox app credentials " +
        "(see docs/PAYPAL_SETUP.md).",
    );
  }
  return { clientId, clientSecret };
}

// ─── Access-token cache — keyed per seller (clientId) so multiple merchants'
// tokens never collide. The default (platform) seller is just one more entry. ──
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get a (cached) OAuth access token via client-credentials for a seller. With no
 * `creds` it uses the platform credentials from env (the single-seller default).
 */
export async function getAccessToken(creds?: SellerCredentials): Promise<string> {
  const { clientId, clientSecret } = creds ?? requireCreds();

  const hit = tokenCache.get(clientId);
  if (hit && Date.now() < hit.expiresAt - 60_000) return hit.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const entry = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  tokenCache.set(clientId, entry);
  return entry.token;
}

/** A fresh idempotency key for create/capture/refund/payout calls. */
export function newRequestId(): string {
  return randomUUID();
}

export interface PayPalRequestOptions {
  method?: string;
  body?: unknown;
  /** Sets PayPal-Request-Id for idempotency on mutating calls. */
  requestId?: string;
  headers?: Record<string, string>;
  /** Route this call to a specific seller's app. Omit for the platform seller. */
  creds?: SellerCredentials;
}

/** Authenticated JSON request against the PayPal REST API. */
export async function paypalRequest<T = unknown>(
  path: string,
  opts: PayPalRequestOptions = {},
): Promise<T> {
  const token = await getAccessToken(opts.creds);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...opts.headers,
  };
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;

  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      `PayPal ${opts.method ?? "GET"} ${path} failed (${res.status}): ${text}`,
    );
  }
  return parsed as T;
}
