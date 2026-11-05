import type { Offer, Reward, AppliedReward } from "@/lib/types";
import { evaluateReward } from "@/lib/optimizer/evaluate";

/**
 * bestStack — pick the combinable reward subset that maximizes savings.
 *
 * Only rewards that evaluateReward accepts for this offer are considered.
 * not_combinable_group: rewards sharing a group value cannot be combined, so
 * from each group at most one is kept. Because each reward's appliedUsd is
 * computed independently of the others and is always > 0, the savings-maximal
 * subset is simply: every reward with no group, plus the single highest-value
 * reward from each not_combinable group. (This is the optimum of the
 * exhaustive search the PRD allows — no subset can beat it.) Total savings are
 * then capped at offer.priceUsd. DETERMINISTIC. OWNER: Rachandeep Kaur.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface Candidate {
  rewardId: string;
  appliedUsd: number;
  group?: string;
}

function notCombinableGroup(reward: Reward): string | undefined {
  const rule = reward.rules.find((r) => r.predicate === "not_combinable_group");
  if (!rule) return undefined;
  return String(rule.value);
}

export function bestStack(
  offer: Offer,
  rewards: Reward[],
): { applied: AppliedReward[]; savedUsd: number } {
  const accepted: Candidate[] = [];
  for (const reward of rewards) {
    const result = evaluateReward(reward, offer);
    if ("appliedUsd" in result) {
      accepted.push({
        rewardId: reward.id,
        appliedUsd: result.appliedUsd,
        group: notCombinableGroup(reward),
      });
    }
  }

  // All freely-combinable rewards are always worth including.
  const chosen: Candidate[] = accepted.filter((c) => c.group === undefined);

  // From each not_combinable group keep the single best (first wins on ties).
  const groups = new Map<string, Candidate[]>();
  for (const c of accepted) {
    if (c.group === undefined) continue;
    const bucket = groups.get(c.group);
    if (bucket) bucket.push(c);
    else groups.set(c.group, [c]);
  }
  for (const bucket of groups.values()) {
    const best = bucket.reduce((m, c) => (c.appliedUsd > m.appliedUsd ? c : m));
    chosen.push(best);
  }

  const rawTotal = chosen.reduce((sum, c) => sum + c.appliedUsd, 0);
  const savedUsd = round2(Math.min(rawTotal, offer.priceUsd));
  const applied: AppliedReward[] = chosen.map((c) => ({
    rewardId: c.rewardId,
    appliedUsd: c.appliedUsd,
  }));

  return { applied, savedUsd };
}
