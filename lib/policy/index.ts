import type { Mandate, Plan, PurchaseIntent, PolicyResult } from "@/lib/types";

/**
 * checkPolicy — Intent + Cart mandate gate → allow | ask | deny.
 *
 * Checked BEFORE approval and again BEFORE capture (see TECH_PRD §2 step 5).
 * DETERMINISTIC. No LLM. OWNER: Rachandeep Kaur.
 *
 * Rules (ALL are evaluated; a reason is accumulated for every non-allow hit):
 *  - mandate expired (expiresAt < now)      → deny
 *  - cashUsd > mandate.capUsd               → deny
 *  - category not in allowCategories (if set)→ deny
 *  - merchant not in allowMerchants (if set) → deny
 *  - cashUsd > mandate.approvalThresholdUsd  → ask
 *  - otherwise                               → allow
 *
 * Precedence: any deny condition → "deny" (all deny reasons retained); else any
 * ask condition → "ask"; else "allow" (reasons: []).
 */

/** Format a USD amount to 2 decimal places for a user-facing reason string. */
function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function checkPolicy(
  intent: PurchaseIntent,
  plan: Plan,
  mandate: Mandate,
): PolicyResult {
  const denyReasons: string[] = [];
  let askReason: string | null = null;

  // mandate expired → deny
  const expiresAt = new Date(mandate.expiresAt);
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    denyReasons.push(`mandate expired on ${expiresAt.toISOString().slice(0, 10)}`);
  }

  // over per-transaction cap → deny
  if (plan.cashUsd > mandate.capUsd) {
    denyReasons.push(
      `${usd(plan.cashUsd)} exceeds per-transaction cap of ${usd(mandate.capUsd)}`,
    );
  }

  // category not in allow-list (only when a list is set) → deny
  if (
    mandate.allowCategories.length > 0 &&
    !mandate.allowCategories.includes(intent.category)
  ) {
    denyReasons.push(`category '${intent.category}' not in allow-list`);
  }

  // merchant not in allow-list (only when a list is set) → deny
  if (
    mandate.allowMerchants.length > 0 &&
    !mandate.allowMerchants.includes(plan.offer.retailer)
  ) {
    denyReasons.push(`merchant '${plan.offer.retailer}' not allowed`);
  }

  // above approval threshold → ask (only matters if not otherwise denied)
  if (plan.cashUsd > mandate.approvalThresholdUsd) {
    askReason = `${usd(plan.cashUsd)} is above your approval threshold of ${usd(
      mandate.approvalThresholdUsd,
    )}`;
  }

  if (denyReasons.length > 0) {
    return { decision: "deny", reasons: denyReasons };
  }
  if (askReason !== null) {
    return { decision: "ask", reasons: [askReason] };
  }
  return { decision: "allow", reasons: [] };
}
