import { NextResponse } from "next/server";
import { PAYPAL_BASE } from "@/lib/paypal/client";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/paypal/callback — Log in with PayPal (OIDC) code exchange.
 *
 * Exchanges the auth code for tokens, fetches userinfo, upserts the User, and
 * drops a minimal session cookie. Session hardening comes later. TECH_PRD §4.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const redirect = process.env.PAYPAL_OIDC_REDIRECT;
  if (!id || !secret || !redirect) {
    return NextResponse.json({ error: "PayPal OIDC not configured" }, { status: 500 });
  }

  try {
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${await tokenRes.text()}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const infoRes = await fetch(
      `${PAYPAL_BASE}/v1/identity/openidconnect/userinfo?schema=openid`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!infoRes.ok) throw new Error(`userinfo failed: ${await infoRes.text()}`);
    const info = (await infoRes.json()) as { payer_id?: string; email?: string };

    const userId = info.payer_id ?? `pp_${Date.now()}`;
    await prisma.user.upsert({
      where: { id: userId },
      update: { paypalPayerId: info.payer_id, email: info.email },
      create: { id: userId, paypalPayerId: info.payer_id, email: info.email },
    });

    const res = NextResponse.redirect(new URL("/", url.origin));
    // Minimal session marker — replace with signed session later.
    res.cookies.set("repal_uid", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "oidc failed" },
      { status: 502 },
    );
  }
}
