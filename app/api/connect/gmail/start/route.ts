import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { isGmailConfigured, buildAuthUrl } from "@/lib/ingest/google";

/** GET — begin Gmail consent (redirect to Google). Requires a signed-in user. */
export async function GET(req: Request) {
  if (!isGmailConfigured()) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/", req.url));

  const state = randomUUID();
  const jar = await cookies();
  jar.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(buildAuthUrl(state));
}
