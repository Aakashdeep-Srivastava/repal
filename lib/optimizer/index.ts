import type {
  PurchaseIntent,
  Offer,
  Reward,
  Mandate,
  OptimizeResult,
} from "@/lib/types";

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
export function optimize(
  _intent: PurchaseIntent,
  _offers: Offer[],
  _rewards: Reward[],
  _mandate: Mandate,
): OptimizeResult {
  // TODO(rachna): implement branch-and-bound in ./stack.ts and rule
  // evaluation in ./evaluate.ts; compose them here into <=3 ranked plans.
  throw new Error("optimize() not implemented");
}
