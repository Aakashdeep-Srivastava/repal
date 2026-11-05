import { NextResponse } from "next/server";
import { setSession, type SessionUser } from "@/lib/auth/session";

/**
 * POST /api/auth/demo-login — log in as the demo user.
 *
 * For local dev / the demo flow. Sets a signed session cookie for `demo-user`
 * so the app behaves as a logged-in user without PayPal OIDC.
 */
export async function POST() {
  const user: SessionUser = { userId: "demo-user", name: "Demo User" };
  await setSession(user);
  return NextResponse.json({ ok: true, user });
}
