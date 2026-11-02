/**
 * Reward ingestion worker.
 *
 * Pulls raw rewards from adapters (gmail / paypal / card / loyalty / channel3 /
 * seed), runs each through the Terms agent (A2) to parse termsRaw → rules, and
 * upserts normalized Reward rows. See docs/TECH_PRD.md §15.
 *
 * OWNER: AI agents layer (pending Aviral/Vishalika confirmation).
 */
export {};

async function main() {
  // TODO: adapter registry → RawReward[] → parseTerms → upsert Reward.
  console.log("[ingest] worker stub — not yet implemented");
}

main().catch((err) => {
  console.error("[ingest] fatal", err);
  process.exit(1);
});
