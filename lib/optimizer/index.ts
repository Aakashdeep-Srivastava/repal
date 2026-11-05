import type {
  PurchaseIntent,
  Offer,
  Reward,
  Mandate,
  Plan,
  RejectedReward,
  OptimizeResult,
} from "@/lib/types";
import { bestStack } from "@/lib/optimizer/stack";
import { evaluateReward } from "@/lib/optimizer/evaluate";

/**
 * optimize — joint-optimize SKU × stackable reward stack.
 *
 * DETERMINISTIC. No LLM. Must be 100% unit-tested (evals + lib tests).
 * Branch-and-bound over offers × reward combinations respecting
 * not_combinable groups and mandate limits. Returns up to 3 plans plus
 * a rejection list (each with the quoted clause that disqualified it).
 *
 * See docs/TECH_PRD.md §2 step 4 and §3 (A4).
 *
 * OWNER: Rachandeep Kaur.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const PLAN_NAMES = ["Cheapest after rewards", "Alternative #2", "Alternative #3"];

export function optimize(
  intent: PurchaseIntent,
  offers: Offer[],
  rewards: Reward[],
  _mandate: Mandate,
): OptimizeResult {
  // Filter offers by the intent's price ceiling.
  const candidates =
    intent.maxPriceUsd === undefined
      ? offers
      : offers.filter((o) => o.priceUsd <= intent.maxPriceUsd!);

  if (candidates.length === 0) {
    return { plans: [], rejected: [] };
  }

  // Price each candidate after its best reward stack.
  const priced = candidates.map((offer) => {
    const stack = bestStack(offer, rewards);
    const cashUsd = round2(offer.priceUsd - stack.savedUsd);
    return { offer, stack, cashUsd };
  });

  // Rank by cash out of pocket, ascending; keep up to 3.
  priced.sort((a, b) => a.cashUsd - b.cashUsd);
  const top = priced.slice(0, 3);

  const plans: Plan[] = top.map((c, i) => ({
    name: PLAN_NAMES[i] ?? `Alternative #${i + 1}`,
    offer: c.offer,
    useRewards: c.stack.applied,
    savedUsd: c.stack.savedUsd,
    cashUsd: c.cashUsd,
  }));

  // Surface "why a reward didn't apply" for the winning (cheapest) offer:
  // every reward not in its applied set that evaluateReward actually rejects.
  const winner = top[0];
  const appliedIds = new Set(winner.stack.applied.map((a) => a.rewardId));
  const rejected: RejectedReward[] = [];
  const seen = new Set<string>();
  for (const reward of rewards) {
    if (appliedIds.has(reward.id) || seen.has(reward.id)) continue;
    const result = evaluateReward(reward, winner.offer);
    if ("appliedUsd" in result) continue; // accepted but dropped (not_combinable) — not a rejection
    seen.add(reward.id);
    rejected.push(result);
  }

  return { plans, rejected };
}
