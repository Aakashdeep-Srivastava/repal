import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lightweight signed-cookie session for RePal.
 *
 * The session is a signed, httpOnly cookie — no server-side store. The payload
 * is a small JSON blob carrying the logged-in user plus an expiry, signed with
 * HMAC-SHA256 so it cannot be tampered with client-side.
 *
 * Cookie value format:  base64url(JSON payload) "." base64url(hmac)
 *   - the HMAC is computed over the base64url(JSON) segment
 *   - on read we recompute the HMAC and compare in constant time, then check exp
 *
 * See TECH_PRD.md §4 (auth). Cookie name: `repal_session`.
 */

export const SESSION_COOKIE = "repal_session";

/** 7 days, in seconds. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Dev-only fallback secret. In production `SESSION_SECRET` MUST be set to a
 * random 32+ byte value — see .env.example. This constant exists only so local
 * dev / the demo works out of the box; it is NOT a secret in any real sense.
 */
const DEV_FALLBACK_SECRET =
  "repal-dev-only-session-secret-do-not-use-in-production";

function getSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;
}

export interface SessionUser {
  userId: string;
  name?: string;
  email?: string;
}

/** Internal on-the-wire shape: the user fields plus an expiry (epoch seconds). */
interface SessionPayload extends SessionUser {
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadSegment: string): string {
  return createHmac("sha256", getSecret()).update(payloadSegment).digest("base64url");
}

/** Build the signed cookie value for a user. */
function encode(user: SessionUser): string {
  const payload: SessionPayload = {
    userId: user.userId,
    ...(user.name !== undefined ? { name: user.name } : {}),
    ...(user.email !== undefined ? { email: user.email } : {}),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadSegment = b64url(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

/** Verify + parse a cookie value. Returns null if tampered, malformed or expired. */
function decode(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;

  const payloadSegment = value.slice(0, dot);
  const providedSig = value.slice(dot + 1);
  const expectedSig = sign(payloadSegment);

  // Constant-time compare; bail if lengths differ (timingSafeEqual throws otherwise).
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.userId !== "string" || !payload.userId) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;

  return {
    userId: payload.userId,
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
  };
}

/** Read the current session user, or null if not logged in / invalid. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decode(store.get(SESSION_COOKIE)?.value);
}

/** Write a signed session cookie for the given user. */
export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encode(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clear the session cookie (logout). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the acting user for existing routes. Falls back to the demo user so
 * routes that predate real auth keep working in dev / the demo.
 */
export async function getSessionUser(): Promise<{ userId: string }> {
  const session = await getSession();
  return { userId: session?.userId ?? "demo-user" };
}
