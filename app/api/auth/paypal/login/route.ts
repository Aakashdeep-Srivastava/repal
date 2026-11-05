import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

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
 * NOTE: the `state` param is generated but NOT persisted/verified in demo mode.
 * A production build would store it (cookie/session) and check it on callback
 * to defend against CSRF; that's an accepted tradeoff for the hackathon demo.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const redirect = process.env.PAYPAL_OIDC_REDIRECT;
  if (!clientId || !redirect) {
    return NextResponse.redirect(new URL("/?auth=unconfigured", origin));
  }

  const authorize = new URL("https://www.sandbox.paypal.com/connect");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: redirect,
    flowEntry: "static",
    state: randomUUID(),
  }).toString();

  return NextResponse.redirect(authorize.toString());
}
