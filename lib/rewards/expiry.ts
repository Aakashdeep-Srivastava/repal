import { prisma } from "@/lib/db";

export interface ExpirySummary {
  ranAt: string;
  expired: number;
  rescueCandidates: number;
}

/**
 * Deterministic expiry scan, shared by the worker (`npm run worker:expiry`) and
 * the scheduled endpoint (POST /api/cron/expiry). Idempotent:
 *  - flips active rewards past their expiry to `expired`
 *  - counts rescue candidates (active, expiring within 3 days)
 *  - pings the DB (keep-alive)
 */
export async function runExpiryScan(now: Date = new Date()): Promise<ExpirySummary> {
  const expired = await prisma.reward.updateMany({
    where: { status: "active", expiresAt: { lt: now } },
    data: { status: "expired" },
  });

  const soon = new Date(now.getTime() + 3 * 86_400_000);
  const rescueCandidates = await prisma.reward.count({
    where: { status: "active", expiresAt: { gte: now, lte: soon } },
  });

  await prisma.$queryRaw`SELECT 1`;

  return { ranAt: now.toISOString(), expired: expired.count, rescueCandidates };
}
