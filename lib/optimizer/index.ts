import type {
  PurchaseIntent,
  Offer,
  Reward,
  Mandate,
  OptimizeResult,
  Plan,
} from "@/lib/types";
import { bestStack, type StackResult } from "@/lib/optimizer/stack";
import { checkPolicy } from "@/lib/policy";
import { toCents, fromCents } from "@/lib/optimizer/money";

/**
 * optimize — joint-optimize SKU × stackable reward stack.
 *
 * DETERMINISTIC. No LLM. Must be 100% unit-tested (evals + lib tests).
 * For every offer, bestStack() finds the exact best reward combination; the
 * offers are then ranked to produce:
 *
 *   Plan A "Cheapest after rewards" — least cash out of pocket, any reward.
 *   Plan B "Keep points"            — same, but never spends `points` rewards
 *                                     (omitted when identical to Plan A).
 *
 * Ranking (per plan): offers the mandate would NOT deny (checkPolicy) and whose
 * cash fits intent.maxPriceUsd come first; then lowest cash; then highest
 * savings; then offer id. If every offer is denied, the best one is still
 * returned so the policy gate can explain the refusal.
 *
 * `rejected` explains every reward NOT used in Plan A, relative to Plan A's
 * offer: why it can't apply (with the quoted clause) or why it was left out.
 *
 * See docs/TECH_PRD.md §2 step 4 and §3 (A4). OWNER: Rachandeep Kaur.
 */
export const PLAN_CHEAPEST = "Cheapest after rewards";
export const PLAN_KEEP_POINTS = "Keep points";

export interface OptimizeOptions {
  /** Clock for expiry checks — injectable for determinism. Defaults to now. */
  now?: Date;
  /** Cash already spent under the mandate's budget window (passed to policy). */
  spentUsd?: number;
}

interface Ranked {
  plan: Plan;
  stack: StackResult;
  eligible: boolean;
}

function rankPlans(
  name: string,
  intent: PurchaseIntent,
  offers: Offer[],
  rewards: Reward[],
  mandate: Mandate,
  opts: Required<Pick<OptimizeOptions, "now">> & OptimizeOptions,
): Ranked | null {
  const ranked: Ranked[] = offers.map((offer) => {
    const stack = bestStack(offer, rewards, { category: intent.category, now: opts.now });
    const cashCents = toCents(offer.priceUsd) - toCents(stack.savedUsd);
    const plan: Plan = {
      name,
      offer,
      useRewards: stack.applied,
      savedUsd: stack.savedUsd,
      cashUsd: fromCents(cashCents),
    };
    const policy = checkPolicy(intent, plan, mandate, { now: opts.now, spentUsd: opts.spentUsd });
    const fitsBudget =
      intent.maxPriceUsd === undefined || cashCents <= toCents(intent.maxPriceUsd);
    return { plan, stack, eligible: policy.decision !== "deny" && fitsBudget };
  });

  ranked.sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      toCents(a.plan.cashUsd) - toCents(b.plan.cashUsd) ||
      toCents(b.plan.savedUsd) - toCents(a.plan.savedUsd) ||
      (a.plan.offer.id < b.plan.offer.id ? -1 : a.plan.offer.id > b.plan.offer.id ? 1 : 0),
  );
  return ranked[0] ?? null;
}

const sameRewards = (a: Plan, b: Plan) =>
  a.useRewards.map((r) => r.rewardId).sort().join(",") ===
  b.useRewards.map((r) => r.rewardId).sort().join(",");

export function optimize(
  intent: PurchaseIntent,
  offers: Offer[],
  rewards: Reward[],
  mandate: Mandate,
  options: OptimizeOptions = {},
): OptimizeResult {
  const opts = { ...options, now: options.now ?? new Date() };

  const a = rankPlans(PLAN_CHEAPEST, intent, offers, rewards, mandate, opts);
  if (!a) {
    return {
      plans: [],
      rejected: rewards.map((r) => ({ rewardId: r.id, reason: "No offer found to apply this reward to" })),
    };
  }

  const plans: Plan[] = [a.plan];
  const b = rankPlans(
    PLAN_KEEP_POINTS,
    intent,
    offers,
    rewards.filter((r) => r.type !== "points"),
    mandate,
    opts,
  );
  if (b && !(b.plan.offer.id === a.plan.offer.id && sameRewards(a.plan, b.plan))) {
    plans.push(b.plan);
  }

  return { plans, rejected: [...a.stack.rejected, ...a.stack.unused] };
}
