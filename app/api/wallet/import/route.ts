import { NextResponse } from "next/server";

/**
 * POST /api/wallet/import — seed / connect-source ingestion entry point.
 *
 * Kicks the ingestion worker (adapters → Terms agent → upsert Reward).
 * OWNER: Rachandeep Kaur (coordinate ingestion worker with the AI agents owner).
 */
export async function POST() {
  // TODO(rachna): enqueue ingestion for the current user's connected sources.
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
