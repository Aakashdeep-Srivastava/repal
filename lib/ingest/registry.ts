import { prisma } from "@/lib/db";
import { parseTerms } from "@/agents/terms";
import { isBedrockConfigured } from "@/lib/ai/bedrock";
import type { RewardRule } from "@/lib/types";
import type { Adapter, IngestSummary, SourceCounts } from "@/lib/ingest/types";
import { gmailAdapter } from "@/lib/ingest/adapters/gmail";
import { paypalAdapter } from "@/lib/ingest/adapters/paypal";
import { cardAdapter } from "@/lib/ingest/adapters/card";
import { loyaltyAdapter } from "@/lib/ingest/adapters/loyalty";
import { channel3Adapter } from "@/lib/ingest/adapters/channel3";

/**
 * Reward-ingestion registry — the core of RePal's multi-source reward
 * collection. Pulls raw rewards from every registered Adapter, parses each
 * reward's free-text T&Cs via the A2 Terms agent, and persists normalized
 * `Reward` rows idempotently. See docs/TECH_PRD.md §15.
 *
 * Idempotency: there is no DB-level unique constraint on reward content, so we
 * do a find-then-create keyed on (userId, source, termsRaw) — re-running an
 * ingestion updates existing rows in place rather than duplicating them.
 *
 * Graceful degradation: `parseTerms` calls the Bedrock Claude model, which is
 * not configured in every environment. Any parse failure is caught and the
 * reward is stored raw (rules: [], parseConfidence: 0) — exactly the
 * "unparsed" pattern prisma/seed.ts uses — so ingestion always fully succeeds.
 *
 * OWNER: AI agents layer (ingestion).
 */

/** Every reward source RePal collects from. */
export const ADAPTERS: Adapter[] = [
  gmailAdapter,
  paypalAdapter,
  cardAdapter,
  loyaltyAdapter,
  channel3Adapter,
];

/**
 * Run reward collection for a user across the given sources (or all adapters
 * when `sources` is omitted/empty). Returns per-source + aggregate counts.
 */
export async function runIngestion(
  userId: string,
  sources?: string[],
): Promise<IngestSummary> {
  // Reward rows FK to User — make sure the acting user exists first so a fresh
  // (e.g. test) userId can ingest without a foreign-key violation.
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const wanted = sources && sources.length > 0 ? new Set(sources) : null;
  const adapters = wanted
    ? ADAPTERS.filter((a) => wanted.has(a.source))
    : ADAPTERS;

  // Decide ONCE whether the Terms agent can run. When Bedrock isn't configured
  // we skip parsing entirely and store rewards raw (unparsed) — otherwise every
  // reward would fire a network call that's guaranteed to fail (slow + noisy).
  const canParse = isBedrockConfigured();

  const summary: IngestSummary = {
    userId,
    bySource: {},
    totalAdded: 0,
    totalUpdated: 0,
    parsed: 0,
    unparsed: 0,
  };

  for (const adapter of adapters) {
    const counts: SourceCounts = { added: 0, updated: 0 };
    summary.bySource[adapter.source] = counts;

    const raws = await adapter.fetch(userId);

    // Collect each reward concurrently — independent rows, so there's no reason
    // to serialize the DB round-trips.
    const outcomes = await Promise.all(
      raws.map((raw) => collectReward(userId, raw, canParse)),
    );

    for (const o of outcomes) {
      if (o.created) {
        counts.added += 1;
        summary.totalAdded += 1;
      } else {
        counts.updated += 1;
        summary.totalUpdated += 1;
      }
      if (o.parsed) summary.parsed += 1;
      else summary.unparsed += 1;
    }
  }

  return summary;
}

/**
 * Persist one raw reward: parse its T&Cs (when the LLM is available), then
 * idempotently find-or-create the row keyed on (userId, source, termsRaw).
 * Returns whether the row was created (vs updated) and whether it parsed.
 */
async function collectReward(
  userId: string,
  raw: { source: string; type: string; valueUsd: number; termsRaw: string; expiresAt: Date; status?: string },
  canParse: boolean,
): Promise<{ created: boolean; parsed: boolean }> {
  // Parse T&Cs → typed rules; fall back to unparsed on ANY error (the LLM may
  // be offline). The try/catch is a second safety net under the `canParse` gate.
  let rules: RewardRule[] = [];
  let parseConfidence = 0;
  let parsed = false;
  if (canParse) {
    try {
      const out = await parseTerms(raw.termsRaw);
      rules = out.rules;
      parseConfidence = out.parseConfidence;
      parsed = true;
    } catch {
      rules = [];
      parseConfidence = 0;
      parsed = false;
    }
  }

  const status = raw.status ?? "active";

  const existing = await prisma.reward.findFirst({
    where: { userId, source: raw.source, termsRaw: raw.termsRaw },
  });

  if (existing) {
    await prisma.reward.update({
      where: { id: existing.id },
      data: {
        valueUsd: raw.valueUsd,
        expiresAt: raw.expiresAt,
        status,
        rules: rules as object[],
        parseConfidence,
        lastSyncedAt: new Date(),
      },
    });
    return { created: false, parsed };
  }

  await prisma.reward.create({
    data: {
      userId,
      source: raw.source,
      type: raw.type,
      valueUsd: raw.valueUsd,
      termsRaw: raw.termsRaw,
      rules: rules as object[],
      status,
      parseConfidence,
      expiresAt: raw.expiresAt,
    },
  });
  return { created: true, parsed };
}
