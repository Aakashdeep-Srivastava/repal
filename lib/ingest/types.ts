/**
 * Reward-ingestion types — the contract between source adapters, the registry,
 * and the wallet. See docs/TECH_PRD.md §15.
 *
 * An Adapter pulls free-text reward offers from one source (gmail / paypal /
 * card / loyalty / channel3). The registry (./registry.ts) normalizes each
 * RawReward, parses its T&Cs via the A2 Terms agent (with graceful fallback),
 * and idempotently persists it as a Prisma `Reward` row.
 *
 * OWNER: AI agents layer (ingestion).
 */

/** A reward as an adapter emits it — pre-parse, pre-persist. */
export interface RawReward {
  source: string;
  type: string;
  valueUsd: number;
  termsRaw: string;
  expiresAt: Date;
  /** Defaults to "active" when the adapter omits it. */
  status?: string;
}

/** One reward source. `fetch` is deterministic + offline-safe in this build. */
export interface Adapter {
  source: string;
  fetch(userId: string): Promise<RawReward[]>;
}

/** Per-source tally of rows written during a run. */
export interface SourceCounts {
  added: number;
  updated: number;
}

/** The result of a full ingestion pass — per-source and aggregate counts. */
export interface IngestSummary {
  userId: string;
  bySource: Record<string, SourceCounts>;
  totalAdded: number;
  totalUpdated: number;
  /** Rewards whose T&Cs the Terms agent parsed into rules this run. */
  parsed: number;
  /** Rewards stored raw/unparsed (rules: [], parseConfidence: 0). */
  unparsed: number;
}
