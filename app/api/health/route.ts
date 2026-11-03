import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health — liveness + DB check.
 *
 * Runs a trivial query so it doubles as a Neon keep-alive target (cron / uptime
 * monitor can hit this). Returns 200 only when the DB answers.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : "db error",
      },
      { status: 503 },
    );
  }
}
