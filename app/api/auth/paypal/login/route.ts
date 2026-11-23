import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PP_STATE_COOKIE } from "@/lib/auth/paypal-state";

/**
 * GET /api/auth/paypal/login — kick off "Log in with PayPal" (OIDC).
 *
 * Builds the PayPal SANDBOX OIDC authorize URL and 302-redirects the browser to
 * it. PayPal then sends the user back to PAYPAL_OIDC_REDIRECT with a `code`,
 * which /api/auth/paypal/callback exchanges for a session. TECH_PRD §4.
 *
 * If the OIDC creds aren't configured we redirect to `/?auth=unconfigured`
 * instead of throwing a 500 — the UI must never hit a raw error for this.
 *
 * CSRF: we generate a random `state`, send it to PayPal, AND store it in a
 * short-lived httpOnly cookie. The callback requires the returned `state` to
 * match the cookie before it will mint a session — defeating login-CSRF /
 * account-fixation. sameSite=lax so the cookie survives PayPal's top-level
 * redirect back to us.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  // "Log in with PayPal" (OIDC) needs an app that has the Log-in feature enabled
  // and this callback registered as a Return URL. That is NOT necessarily the
  // same app as PAYPAL_CLIENT_ID, which may be a platform/partner client used for
  // per-merchant checkout routing. Prefer a dedicated OIDC client when set;
  // fall back to PAYPAL_CLIENT_ID for backward compatibility.
  const clientId = process.env.PAYPAL_OIDC_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  const redirect = process.env.PAYPAL_OIDC_REDIRECT;
  if (!clientId || !redirect) {
    return NextResponse.redirect(new URL("/?auth=unconfigured", origin));
  }

  const state = randomUUID();
  const authorize = new URL("https://www.sandbox.paypal.com/connect");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: redirect,
    flowEntry: "static",
    state,
  }).toString();

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(PP_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/paypal",
    maxAge: 600, // 10 minutes to complete the hop
  });
  return res;
}
