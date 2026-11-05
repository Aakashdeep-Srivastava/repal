/**
 * Reward ingestion worker.
 *
 * Pulls raw rewards from every adapter (gmail / paypal / card / loyalty /
 * channel3), runs each through the Terms agent (A2) to parse termsRaw → rules
 * (gracefully storing raw when the model is offline), and idempotently upserts
 * normalized Reward rows. See docs/TECH_PRD.md §15.
 *
 * Run:  npm run worker:ingest -- <userId>   (defaults to "demo-user")
 *
 * OWNER: AI agents layer (ingestion).
 */
import { prisma } from "@/lib/db";
import { runIngestion } from "@/lib/ingest/registry";

async function main() {
  const userId = process.argv[2] ?? "demo-user";
  const summary = await runIngestion(userId);
  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[ingest] fatal", err);
  await prisma.$disconnect();
  process.exit(1);
});
