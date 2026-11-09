import { prisma } from "@/lib/db";

/**
 * Google OAuth + Gmail (read-only) helpers for consent-first reward ingestion.
 *
 * Privacy posture: we request ONLY `gmail.readonly`, query ONLY reward-looking
 * mail (never the whole inbox), and persist ONLY the extracted offer text — not
 * message bodies. Tokens are revocable (disconnect deletes the row). The whole
 * feature is dormant unless GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set, so
 * the app ships safely with Gmail off and falls back to labelled sample data.
 */

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Gmail search query by scan mode (GMAIL_SCAN_MODE):
 *  - "rewards" (default): server-side filter to reward-looking mail — minimal,
 *    privacy-strong, cheapest.
 *  - "promotions": Gmail's Promotions category (broader, where offers live).
 *  - "full": the agent reads across the inbox. Regardless of mode we only ever
 *    EXTRACT + STORE reward rows (see hasRewardSignal), never other mail.
 */
const REWARD_KEYWORDS =
  '"gift card" OR "e-gift" OR cashback OR "cash back" OR reward OR coupon OR voucher OR "promo code"';

function scanQuery(): string {
  const mode = (process.env.GMAIL_SCAN_MODE ?? "rewards").toLowerCase();
  if (mode === "full") return "newer_than:1y";
  if (mode === "promotions") return "category:promotions newer_than:1y";
  return `(${REWARD_KEYWORDS}) newer_than:1y`;
}

/** True iff this text actually looks like a reward offer (gate for storage). */
export function hasRewardSignal(text: string): boolean {
  return /gift\s?card|e-?gift|cash\s?back|reward|coupon|voucher|promo\s?code|% off|\$\d+\s?off|points|miles|stars/i.test(
    text,
  );
}

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Public callback URL — explicit env, else derived from the PayPal OIDC origin. */
export function googleRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const origin = process.env.PAYPAL_OIDC_REDIRECT
    ? new URL(process.env.PAYPAL_OIDC_REDIRECT).origin
    : "http://localhost:3000";
  return `${origin}/api/connect/gmail/callback`;
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

/** Fetch the signed-in user's Gmail address (for the connected-account badge). */
async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch(`${GMAIL}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  return ((await res.json()) as { emailAddress?: string }).emailAddress;
}

/** Persist tokens for a user after consent (upsert, keyed on userId). */
export async function storeTokens(userId: string, t: TokenResponse): Promise<void> {
  const email = await fetchEmail(t.access_token);
  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000);
  const base = { email, accessToken: t.access_token, expiresAt, scope: t.scope ?? SCOPE };
  await prisma.googleToken.upsert({
    where: { userId },
    update: { ...base, ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}) },
    create: { userId, refreshToken: t.refresh_token ?? "", ...base },
  });
}

export async function disconnectGmail(userId: string): Promise<void> {
  await prisma.googleToken.deleteMany({ where: { userId } });
}

export async function getConnectedEmail(userId: string): Promise<string | null> {
  const row = await prisma.googleToken.findUnique({ where: { userId } });
  return row?.email ?? null;
}

/** A valid access token for the user, refreshing + persisting if expired. Null if not connected. */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const row = await prisma.googleToken.findUnique({ where: { userId } });
  if (!row) return null;
  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now()) {
    return row.accessToken;
  }
  if (!row.refreshToken) return null;
  const t = await refreshAccessToken(row.refreshToken);
  await prisma.googleToken.update({
    where: { userId },
    data: {
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
    },
  });
  return t.access_token;
}

/** A reward email reduced to the fields we actually store (never the full body). */
export interface RewardEmail {
  subject: string;
  snippet: string;
  messageId: string;
}

/**
 * Fetch reward-looking emails for a connected user (read-only). Returns ONLY
 * subject + snippet + message id. Returns [] if the user isn't connected.
 */
export async function fetchRewardEmails(userId: string, max = 20): Promise<RewardEmail[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];
  const auth = { Authorization: `Bearer ${token}` };

  const listRes = await fetch(
    `${GMAIL}/messages?q=${encodeURIComponent(scanQuery())}&maxResults=${Math.min(max, 50)}`,
    { headers: auth },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed (${listRes.status})`);
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).map((m) => m.id);

  const out: RewardEmail[] = [];
  for (const id of ids) {
    const msgRes = await fetch(
      `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=Subject`,
      { headers: auth },
    );
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as {
      snippet?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const subject =
      msg.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "(no subject)";
    out.push({ subject, snippet: msg.snippet ?? "", messageId: id });
  }
  return out;
}

/** Keyword → reward type (coarse; the Terms agent refines rules downstream). */
export function guessType(text: string): string {
  const t = text.toLowerCase();
  if (/gift\s?card|e-?gift|voucher/.test(t)) return "giftcard";
  if (/cash\s?back/.test(t)) return "cashback";
  if (/coupon|promo code|% off|\$\d+ off/.test(t)) return "coupon";
  if (/points|miles|stars/.test(t)) return "points";
  return "offer";
}
