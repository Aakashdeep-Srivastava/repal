import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runExpiryScan } from "@/lib/rewards/expiry";

/**
 * POST /api/cron/expiry — the scheduled expiry scan, called daily by the
 * notifier Lambda (EventBridge). Protected by a shared secret header so random
 * callers can't trigger the DB mutation.
 *
 * If CRON_SECRET is unset (local/dev), the check is skipped.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: a destructive DB mutation must never be callable
  // just because the secret was left unset (misconfig). Only local/dev may skip.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "cron not configured" }, { status: 503 });
    }
  } else {
    const provided = req.headers.get("x-cron-secret");
    // Constant-time compare to avoid leaking the secret via timing.
    const a = Buffer.from(provided ?? "");
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const summary = await runExpiryScan();
  return NextResponse.json({ ok: true, ...summary });
}
