/**
 * Nightly expiry scan (manual / local run — the scheduled path is
 * POST /api/cron/expiry, called daily by the notifier Lambda).
 *
 * Run:  npm run worker:expiry
 */
import { prisma } from "@/lib/db";
import { runExpiryScan } from "@/lib/rewards/expiry";

async function main() {
  const summary = await runExpiryScan();
  console.log("[expiry]", JSON.stringify(summary));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[expiry] fatal", err);
  await prisma.$disconnect();
  process.exit(1);
});
