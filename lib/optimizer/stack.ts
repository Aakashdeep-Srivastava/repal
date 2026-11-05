import type { Offer, Reward, AppliedReward, RejectedReward } from "@/lib/types";
import { evaluateReward, isRejected, stackingGroup, type EvalContext } from "@/lib/optimizer/evaluate";
import { toCents, fromCents } from "@/lib/optimizer/money";

/**
 * bestStack — branch-and-bound over combinable reward subsets for one offer.
 *
 * Respects not_combinable groups. Returns the subset that maximizes savings
 * (subject to each reward's own caps). DETERMINISTIC. OWNER: Rachandeep Kaur.
 *
 * Search: exact (not greedy). At most one reward per not_combinable_group;
 * rewards without a group combine freely. Savings can never exceed the price
 * (residual cash ≥ 0). Among equal-savings stacks, prefer — in order —
 *   1. less wasted value (sum of rewards − price, when over-covered),
 *   2. rewards that expire sooner (rescue value before it's lost),
 *   3. fewer rewards, then reward ids (total order → fully deterministic).
 * If the stack over-covers the price, sooner-expiring rewards are applied in
 * full first and the last one is applied partially.
 */

interface Candidate {
  reward: Reward;
  cents: number;
  expiry: number;
  group: string | null;
  groupClause?: string;
}

interface Score {
  savings: number;
  waste: number;
  expiries: number[];
  ids: string[];
}

function scoreOf(chosen: Candidate[], price: number): Score {
  const sum = chosen.reduce((s, c) => s + c.cents, 0);
  const savings = Math.min(sum, price);
  const sorted = [...chosen].sort(byExpiryThenId);
  return {
    savings,
    waste: sum - savings,
    expiries: sorted.map((c) => c.expiry),
    ids: sorted.map((c) => c.reward.id),
  };
}

/** Negative if a is better than b. */
function compare(a: Score, b: Score): number {
  if (a.savings !== b.savings) return b.savings - a.savings;
  if (a.waste !== b.waste) return a.waste - b.waste;
  for (let i = 0; i < Math.min(a.expiries.length, b.expiries.length); i++) {
    if (a.expiries[i] !== b.expiries[i]) return a.expiries[i] - b.expiries[i];
  }
  if (a.ids.length !== b.ids.length) return a.ids.length - b.ids.length;
  return a.ids.join("\u0000") < b.ids.join("\u0000") ? -1 : a.ids.join("\u0000") > b.ids.join("\u0000") ? 1 : 0;
}

function byExpiryThenId(a: Candidate, b: Candidate): number {
  return a.expiry - b.expiry || (a.reward.id < b.reward.id ? -1 : a.reward.id > b.reward.id ? 1 : 0);
}

export interface StackResult {
  applied: AppliedReward[];
  savedUsd: number;
  /** Rewards that cannot apply to this offer, with reason + quoted clause. */
  rejected: RejectedReward[];
  /** Rewards that could apply but were left out (stacking conflict / not needed). */
  unused: RejectedReward[];
}

export function bestStack(offer: Offer, rewards: Reward[], ctx: EvalContext): StackResult {
  const price = toCents(offer.priceUsd);
  const rejected: RejectedReward[] = [];
  const candidates: Candidate[] = [];

  for (const reward of rewards) {
    const r = evaluateReward(reward, offer, ctx);
    if (isRejected(r)) {
      rejected.push(r);
      continue;
    }
    const g = stackingGroup(reward);
    const expiry = Date.parse(reward.expiresAt);
    candidates.push({
      reward,
      cents: toCents(r.appliedUsd),
      expiry: Number.isNaN(expiry) ? Number.MAX_SAFE_INTEGER : expiry,
      group: g?.group ?? null,
      groupClause: g?.quotedClause,
    });
  }

  // Slots: one per group (pick ≤1 member) and one per ungrouped candidate.
  const groups = new Map<string, Candidate[]>();
  const slots: Candidate[][] = [];
  for (const c of [...candidates].sort(byExpiryThenId)) {
    if (c.group === null) {
      slots.push([c]);
    } else {
      if (!groups.has(c.group)) {
        groups.set(c.group, []);
        slots.push(groups.get(c.group)!);
      }
      groups.get(c.group)!.push(c);
    }
  }
  const slotMax = slots.map((s) => Math.max(...s.map((c) => c.cents)));
  // Bigger slots first → tighter bounds sooner.
  const order = slots.map((_, i) => i).sort((a, b) => slotMax[b] - slotMax[a] || a - b);
  const remainingMax: number[] = new Array(order.length + 1).fill(0);
  for (let i = order.length - 1; i >= 0; i--) remainingMax[i] = remainingMax[i + 1] + slotMax[order[i]];

  let best: Candidate[] = [];
  let bestScore = scoreOf(best, price);
  const chosen: Candidate[] = [];

  const dfs = (i: number, sum: number) => {
    const s = scoreOf(chosen, price);
    if (compare(s, bestScore) < 0) {
      best = [...chosen];
      bestScore = s;
    }
    if (i === order.length || sum >= price) return; // adding more only wastes value
    if (Math.min(price, sum + remainingMax[i]) < bestScore.savings) return; // bound
    for (const c of slots[order[i]]) {
      chosen.push(c);
      dfs(i + 1, sum + c.cents);
      chosen.pop();
    }
    dfs(i + 1, sum); // skip this slot
  };
  dfs(0, 0);

  // Allocate: sooner-expiring first; the last may be partial.
  const applied: AppliedReward[] = [];
  let left = price;
  for (const c of [...best].sort(byExpiryThenId)) {
    const use = Math.min(c.cents, left);
    left -= use;
    applied.push({ rewardId: c.reward.id, appliedUsd: fromCents(use) });
  }
  const savedCents = price - left;

  const chosenIds = new Set(best.map((c) => c.reward.id));
  const unused: RejectedReward[] = candidates
    .filter((c) => !chosenIds.has(c.reward.id))
    .map((c) => {
      const rival = c.group ? best.find((b) => b.group === c.group) : undefined;
      if (rival) {
        return {
          rewardId: c.reward.id,
          reason: `Stacking conflict: cannot be combined with ${rival.reward.id} (group "${c.group}")`,
          ...(c.groupClause ? { quotedClause: c.groupClause } : {}),
        };
      }
      return {
        rewardId: c.reward.id,
        reason: savedCents === price ? "Not needed: price already fully covered by other rewards" : "Not selected",
      };
    });

  return { applied, savedUsd: fromCents(savedCents), rejected, unused };
}
