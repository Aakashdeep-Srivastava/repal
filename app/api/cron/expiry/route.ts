import { NextResponse } from "next/server";
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
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const summary = await runExpiryScan();
  return NextResponse.json({ ok: true, ...summary });
}
