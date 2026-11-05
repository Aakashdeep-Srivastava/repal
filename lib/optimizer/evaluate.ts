import type { Offer, Reward, RejectedReward } from "@/lib/types";

/**
 * evaluateReward — can this reward apply to this offer?
 *
 * Returns the applicable discount (usd) or a rejection with the quoted clause.
 * DETERMINISTIC. OWNER: Rachandeep Kaur.
 */
export function evaluateReward(
  _reward: Reward,
  _offer: Offer,
): { appliedUsd: number } | RejectedReward {
  // TODO(rachan): walk reward.rules against the offer (min spend, category
  // allow/deny, merchant allow-list, expiry, max discount) and produce either
  // the applicable discount or a rejection citing the clause.
  throw new Error("evaluateReward() not implemented");
}
