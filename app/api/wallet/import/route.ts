import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/wallet/import — seed / connect-source ingestion entry point.
 *
 * The wallet is auto-seeded (prisma/seed.ts) and connect-source ingestion
 * (Gmail / PayPal offers / Channel3) runs via workers/ingest.ts, which uses the
 * A2 Terms agent to parse each reward's free-text T&Cs into typed rules. This
 * endpoint reports the current wallet so the UI can confirm an import landed.
 * OWNER: Rachandeep Kaur (coordinate ingestion worker with the AI agents owner).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId ?? "demo-user";
  const [count, unparsed] = await Promise.all([
    prisma.reward.count({ where: { userId } }),
    prisma.reward.count({ where: { userId, parseConfidence: 0 } }),
  ]);
  return NextResponse.json({
    userId,
    imported: count,
    unparsed,
    note: "Wallet is auto-seeded; connect-source ingestion + T&C parsing runs via workers/ingest.ts.",
  });
}
