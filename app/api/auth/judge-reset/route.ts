import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resetJudge, JUDGE_USER_ID } from "@/lib/demo/judge";

/**
 * POST /api/auth/judge-reset — reset the judge persona back to a fresh state.
 *
 * Only the signed-in judge may reset (scoped strictly to JUDGE_USER_ID), so one
 * judge can wipe prior receipts/payouts and start clean. Gated by JUDGE_DEMO.
 */
export async function POST() {
  if ((process.env.JUDGE_DEMO ?? "on").toLowerCase() === "off") {
    return NextResponse.json({ error: "Judge demo disabled" }, { status: 404 });
  }
  const session = await getSession();
  if (session?.userId !== JUDGE_USER_ID) {
    return NextResponse.json({ error: "Not the judge persona" }, { status: 403 });
  }
  await resetJudge();
  return NextResponse.json({ ok: true });
}
