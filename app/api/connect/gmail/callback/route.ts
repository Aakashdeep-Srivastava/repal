import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import {
  isGmailConfigured,
  exchangeCode,
  storeTokens,
  googleRedirectUri,
} from "@/lib/ingest/google";

/** GET — Google OAuth callback: verify state, exchange code, store tokens. */
export async function GET(req: Request) {
  // Redirect onto the public origin (CloudFront), not the ALB host.
  const base = new URL(googleRedirectUri()).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expected = jar.get("gmail_oauth_state")?.value;

  if (!isGmailConfigured() || !code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/wallet?gmail=error", base));
  }
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/?gmail=signin", base));

  try {
    const tokens = await exchangeCode(code);
    await storeTokens(session.userId, tokens);
    jar.delete("gmail_oauth_state");
    return NextResponse.redirect(new URL("/wallet?gmail=connected", base));
  } catch {
    return NextResponse.redirect(new URL("/wallet?gmail=error", base));
  }
}
