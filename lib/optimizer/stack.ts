import type { Offer, Reward, AppliedReward } from "@/lib/types";

/**
 * bestStack — branch-and-bound over combinable reward subsets for one offer.
 *
 * Respects not_combinable groups. Returns the subset that maximizes savings
 * (subject to each reward's own caps). DETERMINISTIC. OWNER: Rachandeep Kaur.
 */
export function bestStack(
  _offer: Offer,
  _rewards: Reward[],
): { applied: AppliedReward[]; savedUsd: number } {
  // TODO(rachna): branch-and-bound with pruning on not_combinable groups.
  throw new Error("bestStack() not implemented");
}
