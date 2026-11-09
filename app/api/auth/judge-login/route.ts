import { NextResponse } from "next/server";
import { setSession, type SessionUser } from "@/lib/auth/session";
import { seedJudge, JUDGE_USER_ID, JUDGE_NAME } from "@/lib/demo/judge";

/**
 * POST /api/auth/judge-login — one-click hackathon-judge sign-in.
 *
 * Seeds (or re-seeds) a self-contained US persona "Maya" — a signed spending
 * mandate + a small, clearly-labelled sample wallet — then sets the session to
 * that user. Lets judges exercise the full agent → policy → PayPal flow without
 * their own PayPal/Gmail sandbox. Gated by JUDGE_DEMO (on by default).
 */
export async function POST() {
  if ((process.env.JUDGE_DEMO ?? "on").toLowerCase() === "off") {
    return NextResponse.json({ error: "Judge demo disabled" }, { status: 404 });
  }
  await seedJudge();
  const user: SessionUser = { userId: JUDGE_USER_ID, name: JUDGE_NAME };
  await setSession(user);
  return NextResponse.json({ ok: true, user });
}
