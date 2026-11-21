/**
 * Test database helpers — ISOLATED DB ONLY.
 *
 * Non-negotiable safety rule (spec §8): tests NEVER touch the shared production
 * Neon database. This factory refuses to run unless an explicit `QA_DATABASE_URL`
 * is set AND it differs from the app's configured `DATABASE_URL` (prod). That
 * makes "accidentally pointed at prod" a hard error, not a silent catastrophe.
 *
 * Every test worker should use synthetic users/records under a unique prefix and
 * clean up only its own rows (never a blanket wipe).
 */
import { PrismaClient } from "@prisma/client";

/**
 * A PrismaClient bound to the isolated QA DB. Throws if QA_DATABASE_URL is unset
 * or equals the app's DATABASE_URL (the prod connection) — fail closed.
 */
export function testPrisma(): PrismaClient {
  const qa = process.env.QA_DATABASE_URL;
  if (!qa) {
    throw new Error(
      "QA_DATABASE_URL is not set. Point it at an ISOLATED Neon dev branch — never prod.",
    );
  }
  if (process.env.DATABASE_URL && qa === process.env.DATABASE_URL) {
    throw new Error(
      "QA_DATABASE_URL equals DATABASE_URL (prod). Refusing to run tests against production.",
    );
  }
  return new PrismaClient({ datasources: { db: { url: qa } }, log: ["error"] });
}

/**
 * Remove only the rows a test worker created, keyed by a synthetic-user prefix,
 * in FK-safe order. Never deletes rows outside the prefix, so parallel workers
 * and seeded baseline data are untouched.
 */
export async function cleanupByUserPrefix(prisma: PrismaClient, prefix: string): Promise<void> {
  if (!prefix || prefix.length < 4) throw new Error("cleanupByUserPrefix: prefix too short (unsafe)");
  const users = await prisma.user.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const redemptions = await prisma.redemption.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const redemptionIds = redemptions.map((r) => r.id);

  // Children first (ledger graph), then redemptions, then the users' own rows.
  await prisma.attribution.deleteMany({ where: { redemptionId: { in: redemptionIds } } });
  await prisma.commissionLedger.deleteMany({ where: { redemptionId: { in: redemptionIds } } });
  await prisma.customerRewardLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.redemption.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.receipt.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payout.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refund.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.reward.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.mandate.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
