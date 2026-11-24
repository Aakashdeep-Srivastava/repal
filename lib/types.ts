/**
 * RePal shared domain types — the deterministic contracts.
 *
 * These are the stable interfaces the optimizer, policy engine, and receipt
 * signer agree on. The LLM layer (agents/) produces/consumes the *edges* of
 * these types but NEVER computes the money fields. See docs/TECH_PRD.md §1.
 *
 * OWNER: Rachandeep Kaur (backend domain services).
 */

// ─── Intent ──────────────────────────────────────────────────────────
export interface PurchaseIntent {
  rawText: string;
  category: string; // e.g. "headphones"
  maxPriceUsd?: number;
  merchantPreferences?: string[];
  mustHave?: string[];
}

// ─── Rewards ─────────────────────────────────────────────────────────
export type RewardStatus = "active" | "expiring" | "expired" | "used";

export interface Reward {
  id: string;
  source: "gmail" | "paypal" | "card" | "loyalty" | "channel3" | "seed";
  type: string; // "cashback" | "giftcard" | "points" | "coupon" | ...
  valueUsd: number;
  termsRaw: string;
  rules: RewardRule[]; // parsed by the Terms agent (A2), validated here
  status: RewardStatus;
  parseConfidence: number; // 0..1
  expiresAt: string; // ISO
}

/** A single typed predicate extracted from a reward's T&Cs. */
export interface RewardRule {
  predicate: string; // see lib/tnc/schema.ts vocabulary
  value: number | string | string[];
  quotedClause: string; // the verbatim clause this rule came from
}

// ─── Offers (Channel3) ───────────────────────────────────────────────
export interface Offer {
  id: string;
  title: string;
  priceUsd: number;
  retailer: string;
  buyUrl: string;
}

// ─── Mandate (Vault-backed authority) ────────────────────────────────
export interface Mandate {
  id: string;
  capUsd: number; // max per transaction
  budgetUsd: number; // rolling budget
  approvalThresholdUsd: number; // above this → always ask
  allowCategories: string[];
  allowMerchants: string[];
  expiresAt: string; // ISO
  paypalVaultTokenId?: string;
}

// ─── Optimizer output ────────────────────────────────────────────────
/**
 * How a reward's value is realised, for financial accuracy:
 *  - "instant"   — a checkout discount; reduces the amount paid now (cashUsd).
 *  - "cashback"  — paid back after the purchase (statement credit / cashback);
 *                  an estimate that does NOT reduce today's charge.
 *  - "points"    — loyalty points/miles; value depends on redemption.
 */
export type RewardEffect = "instant" | "cashback" | "points";

export interface AppliedReward {
  rewardId: string;
  appliedUsd: number;
  effect: RewardEffect;
}

export interface RejectedReward {
  rewardId: string;
  reason: string;
  quotedClause?: string;
}

export interface Plan {
  name: string; // "Cheapest after rewards" | "Keep points" | ...
  offer: Offer;
  useRewards: AppliedReward[];
  savedUsd: number; // INSTANT discounts only — what reduces the charge now
  /** Post-purchase cashback / statement credit — estimated, paid AFTER, does
   *  NOT reduce cashUsd. */
  cashbackUsd: number;
  /** Loyalty points/miles value — redemption-dependent, informational only. */
  pointsUsd: number;
  cashUsd: number; // what PayPal actually moves now (price − savedUsd)
}

export interface OptimizeResult {
  plans: Plan[]; // up to 3
  rejected: RejectedReward[];
}

// ─── Policy engine ───────────────────────────────────────────────────
export type PolicyDecision = "allow" | "ask" | "deny";

export interface PolicyResult {
  decision: PolicyDecision;
  reasons: string[];
}
