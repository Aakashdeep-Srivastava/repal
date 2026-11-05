import type { Mandate, Plan, PurchaseIntent, PolicyResult } from "@/lib/types";
import { categoryMatches } from "@/lib/tnc/categories";
import { merchantMatches } from "@/lib/tnc/merchants";
import { toCents, fmtUsd } from "@/lib/optimizer/money";

/**
 * checkPolicy — Intent + Cart mandate gate → allow | ask | deny.
 *
 * Checked BEFORE approval and again BEFORE capture (see TECH_PRD §2 step 5).
 * DETERMINISTIC. No LLM. OWNER: Rachandeep Kaur.
 *
 * Rules (every failing rule adds a human-readable reason):
 *  - mandate expired (now ≥ expiresAt)                  → deny
 *  - cashUsd > mandate.capUsd (per transaction)          → deny
 *  - spentUsd + cashUsd > mandate.budgetUsd              → deny  (only when the
 *    caller passes `spentUsd`; the caller decides the budget window)
 *  - intent category not allowed (incl. parent map)      → deny  (empty list = any)
 *  - offer retailer not allowed                          → deny  (empty list = any)
 *  - cashUsd > mandate.approvalThresholdUsd              → ask
 *  - otherwise                                           → allow (reasons = [])
 * Any deny wins over ask. Amounts compared in integer cents.
 */
export interface PolicyContext {
  /** Clock for expiry checks — injectable so the gate stays deterministic. */
  now?: Date;
  /** Cash already spent under this mandate in the current budget window. */
  spentUsd?: number;
}

export function checkPolicy(
  intent: PurchaseIntent,
  plan: Plan,
  mandate: Mandate,
  ctx: PolicyContext = {},
): PolicyResult {
  const now = ctx.now ?? new Date();
  const deny: string[] = [];
  const ask: string[] = [];
  const cash = toCents(plan.cashUsd);

  const expiresAt = Date.parse(mandate.expiresAt);
  if (Number.isNaN(expiresAt)) {
    deny.push(`Mandate expiry "${mandate.expiresAt}" is not a valid date.`);
  } else if (now.getTime() >= expiresAt) {
    deny.push(`Mandate expired on ${new Date(expiresAt).toISOString()}.`);
  }

  if (cash > toCents(mandate.capUsd)) {
    deny.push(
      `${fmtUsd(plan.cashUsd)} exceeds the per-purchase cap of ${fmtUsd(mandate.capUsd)}.`,
    );
  }

  if (ctx.spentUsd !== undefined) {
    const after = toCents(ctx.spentUsd) + cash;
    if (after > toCents(mandate.budgetUsd)) {
      deny.push(
        `Budget exceeded: ${fmtUsd(ctx.spentUsd)} already spent + ${fmtUsd(plan.cashUsd)} ` +
          `is over the ${fmtUsd(mandate.budgetUsd)} budget.`,
      );
    }
  }

  if (mandate.allowCategories.length > 0 && !categoryMatches(intent.category, mandate.allowCategories)) {
    deny.push(
      `Category "${intent.category}" is not allowed by the mandate (allowed: ${mandate.allowCategories.join(", ")}).`,
    );
  }

  if (mandate.allowMerchants.length > 0 && !merchantMatches(plan.offer.retailer, mandate.allowMerchants)) {
    deny.push(
      `Merchant "${plan.offer.retailer}" is not allowed by the mandate (allowed: ${mandate.allowMerchants.join(", ")}).`,
    );
  }

  if (cash > toCents(mandate.approvalThresholdUsd)) {
    ask.push(
      `${fmtUsd(plan.cashUsd)} is above the ${fmtUsd(mandate.approvalThresholdUsd)} approval threshold — needs your OK.`,
    );
  }

  if (deny.length > 0) return { decision: "deny", reasons: [...deny, ...ask] };
  if (ask.length > 0) return { decision: "ask", reasons: ask };
  return { decision: "allow", reasons: [] };
}
