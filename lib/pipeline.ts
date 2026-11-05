import { prisma } from "@/lib/db";
import { findOffers } from "@/lib/channel3";
import { optimize } from "@/lib/optimizer";
import { checkPolicy } from "@/lib/policy";
import type {
  Reward,
  RewardRule,
  Mandate,
  Offer,
  PurchaseIntent,
  Plan,
  PolicyResult,
  RejectedReward,
} from "@/lib/types";

/**
 * Deterministic cart pipeline — the money-math composite the orchestrator calls
 * as ONE high-level tool. Loads wallet + mandate from the DB, gets offers
 * (cache → Channel3), runs the deterministic optimizer, and gates each plan
 * through the policy engine. NO LLM — every number here is deterministic and
 * unit-tested in its own module. See docs/TECH_PRD.md §2 steps 3–5.
 */

export interface PlanWithPolicy extends Plan {
  policy: PolicyResult;
}

export interface PlanPurchaseResult {
  intent: PurchaseIntent;
  plans: PlanWithPolicy[];
  rejected: RejectedReward[];
  mandateId: string;
  offerCount: number;
}

type RewardRow = Awaited<ReturnType<typeof prisma.reward.findMany>>[number];
type MandateRow = NonNullable<Awaited<ReturnType<typeof prisma.mandate.findFirst>>>;
type OfferRow = Awaited<ReturnType<typeof prisma.offer.findMany>>[number];

function toReward(r: RewardRow): Reward {
  return {
    id: r.id,
    source: r.source as Reward["source"],
    type: r.type,
    valueUsd: r.valueUsd,
    termsRaw: r.termsRaw,
    rules: Array.isArray(r.rules) ? (r.rules as unknown as RewardRule[]) : [],
    status: r.status as Reward["status"],
    parseConfidence: r.parseConfidence,
    expiresAt: r.expiresAt.toISOString(),
  };
}

function toMandate(m: MandateRow): Mandate {
  return {
    id: m.id,
    capUsd: m.capUsd,
    budgetUsd: m.budgetUsd,
    approvalThresholdUsd: m.approvalThresholdUsd,
    allowCategories: m.allowCategories,
    allowMerchants: m.allowMerchants,
    expiresAt: m.expiresAt.toISOString(),
    paypalVaultTokenId: m.paypalVaultTokenId ?? undefined,
  };
}

function toOffer(o: OfferRow): Offer {
  return { id: o.id, title: o.title, priceUsd: o.priceUsd, retailer: o.retailer, buyUrl: o.buyUrl };
}

/**
 * A permissive fallback mandate for demo users who haven't created one yet, so
 * the pipeline still returns plans (policy will mostly `allow`). Real runs use
 * the user's Vault-backed mandate.
 */
function demoMandate(): Mandate {
  return {
    id: "demo-mandate",
    capUsd: 1000,
    budgetUsd: 1000,
    approvalThresholdUsd: 500,
    allowCategories: [],
    allowMerchants: [],
    expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  };
}

/** Offers for a query: DB cache (1h) first, then Channel3 on miss. */
async function getOffers(query: string, maxPriceUsd?: number): Promise<Offer[]> {
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const cached = await prisma.offer.findMany({
    where: { query, cachedAt: { gte: oneHourAgo } },
    orderBy: { priceUsd: "asc" },
    take: 20,
  });
  if (cached.length > 0) {
    const offers = cached.map(toOffer);
    return maxPriceUsd === undefined ? offers : offers.filter((o) => o.priceUsd <= maxPriceUsd);
  }
  // Cache miss → live Channel3 (requires CHANNEL3_API_KEY).
  return findOffers(query, { maxPriceUsd, limit: 10 });
}

/**
 * Eligibility + optimization for ONE already-chosen product (the shopping
 * journey's product-detail step). Same deterministic engine as planPurchase,
 * but the offer set is exactly the selected product — so the optimizer computes
 * which of the user's rewards actually apply to THIS item, the resulting savings,
 * and (for the winner) the rewards it rejected with the disqualifying clause.
 * Reuses optimize() + checkPolicy() — no money is computed outside lib/.
 */
export async function eligibilityForProduct(args: {
  userId: string;
  offer: Offer;
  category: string;
  maxPriceUsd?: number;
}): Promise<PlanPurchaseResult> {
  const [rewardRows, mandateRow] = await Promise.all([
    prisma.reward.findMany({ where: { userId: args.userId } }),
    prisma.mandate.findFirst({ where: { userId: args.userId, status: "active" } }),
  ]);

  const rewards = rewardRows.map(toReward);
  const mandate = mandateRow ? toMandate(mandateRow) : demoMandate();
  const intent: PurchaseIntent = {
    rawText: args.offer.title,
    category: args.category,
    maxPriceUsd: args.maxPriceUsd,
  };

  const { plans, rejected } = optimize(intent, [args.offer], rewards, mandate);
  const gated: PlanWithPolicy[] = plans.map((p) => ({
    ...p,
    policy: checkPolicy(intent, p, mandate),
  }));

  return { intent, plans: gated, rejected, mandateId: mandate.id, offerCount: 1 };
}

/**
 * Run the full deterministic plan: wallet + mandate (DB) → offers (cache/Channel3)
 * → optimizer → policy gate per plan. Returns up to 3 policy-gated plans plus the
 * rejection list (each with the clause that disqualified a reward).
 */
export async function planPurchase(args: {
  userId: string;
  category: string;
  maxPriceUsd?: number;
}): Promise<PlanPurchaseResult> {
  const [rewardRows, mandateRow, offers] = await Promise.all([
    prisma.reward.findMany({ where: { userId: args.userId } }),
    prisma.mandate.findFirst({ where: { userId: args.userId, status: "active" } }),
    getOffers(args.category, args.maxPriceUsd),
  ]);

  const rewards = rewardRows.map(toReward);
  const mandate = mandateRow ? toMandate(mandateRow) : demoMandate();
  const intent: PurchaseIntent = {
    rawText: args.category,
    category: args.category,
    maxPriceUsd: args.maxPriceUsd,
  };

  const { plans, rejected } = optimize(intent, offers, rewards, mandate);
  const gated: PlanWithPolicy[] = plans.map((p) => ({
    ...p,
    policy: checkPolicy(intent, p, mandate),
  }));

  return { intent, plans: gated, rejected, mandateId: mandate.id, offerCount: offers.length };
}
