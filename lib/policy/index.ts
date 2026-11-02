import type { Mandate, Plan, PurchaseIntent, PolicyResult } from "@/lib/types";

/**
 * checkPolicy — Intent + Cart mandate gate → allow | ask | deny.
 *
 * Checked BEFORE approval and again BEFORE capture (see TECH_PRD §2 step 5).
 * DETERMINISTIC. No LLM. OWNER: Rachandeep Kaur.
 *
 * Rules (non-exhaustive):
 *  - cashUsd > mandate.capUsd              → deny
 *  - cashUsd > mandate.approvalThresholdUsd → ask
 *  - category not in allowCategories        → deny
 *  - merchant not in allowMerchants (if set)→ deny
 *  - mandate expired                        → deny
 *  - otherwise                              → allow
 */
export function checkPolicy(
  _intent: PurchaseIntent,
  _plan: Plan,
  _mandate: Mandate,
): PolicyResult {
  // TODO(rachna): implement the mandate checks above; accumulate human-readable
  // reasons for every non-allow decision (surfaced in the approval sheet).
  throw new Error("checkPolicy() not implemented");
}
