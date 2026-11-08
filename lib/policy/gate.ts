import type { Mandate, Plan, PurchaseIntent, PolicyResult } from "@/lib/types";
import { prisma } from "@/lib/db";
import { checkPolicy } from "@/lib/policy";
import { verifyMandate } from "@/lib/policy/mandate";

/**
 * Server-side spend gate — the SECOND policy check (TECH_PRD §2 step 5): run
 * again, deterministically, right before money moves (capture / payout), using
 * the user's REAL active mandate loaded here (never a client-supplied one).
 *
 * - Loads the active mandate, tamper-checks its signature (verifyMandate); a
 *   tampered mandate hard-denies.
 * - Falls back to the same permissive demo mandate the pipeline uses when the
 *   user has none, so the demo flow is never blocked.
 * - Enforces the rolling budget by passing `spentUsd` = the sum of the user's
 *   prior receipts (which `checkPolicy` ignores unless provided).
 *
 * The amounts come from the optimizer's plan (the caller), never recomputed.
 */
export interface SpendGateInput {
  userId: string;
  category: string;
  merchant: string; // offer.retailer
  cashUsd: number;
}

export interface SpendGateResult extends PolicyResult {
  mandateId: string | null;
  vaultBacked: boolean;
  spentUsd: number;
}

/** Mirror of lib/pipeline's demoMandate() fallback — permissive, so demos pass. */
function demoMandate(): Mandate {
  const expires = new Date();
  expires.setDate(expires.getDate() + 365);
  return {
    id: "demo-mandate",
    capUsd: 1000,
    budgetUsd: 1000,
    approvalThresholdUsd: 500,
    allowCategories: [],
    allowMerchants: [],
    expiresAt: expires.toISOString(),
  };
}

export async function gateSpend(input: SpendGateInput): Promise<SpendGateResult> {
  const row = await prisma.mandate.findFirst({
    where: { userId: input.userId, status: "active" },
    orderBy: { expiresAt: "desc" },
  });

  let mandate: Mandate;
  let mandateId: string | null = null;
  let vaultBacked = false;

  if (row) {
    mandate = {
      id: row.id,
      capUsd: row.capUsd,
      budgetUsd: row.budgetUsd,
      approvalThresholdUsd: row.approvalThresholdUsd,
      allowCategories: row.allowCategories,
      allowMerchants: row.allowMerchants,
      expiresAt: row.expiresAt.toISOString(),
      paypalVaultTokenId: row.paypalVaultTokenId ?? undefined,
    };
    vaultBacked = Boolean(row.paypalVaultTokenId);
    mandateId = row.id;
    // Refuse to spend against a tampered mandate.
    if (!verifyMandate(mandate, row.userId, row.signatureHash)) {
      return {
        decision: "deny",
        reasons: ["Mandate signature is invalid — refusing to act on a tampered mandate."],
        mandateId,
        vaultBacked,
        spentUsd: 0,
      };
    }
  } else {
    mandate = demoMandate();
  }

  const agg = await prisma.receipt.aggregate({
    where: { userId: input.userId },
    _sum: { cashUsd: true },
  });
  const spentUsd = agg._sum.cashUsd ?? 0;

  // Minimal intent/plan — checkPolicy only reads category, cashUsd, retailer.
  const intent = { category: input.category } as PurchaseIntent;
  const plan = { offer: { retailer: input.merchant }, cashUsd: input.cashUsd } as unknown as Plan;

  const result = checkPolicy(intent, plan, mandate, { spentUsd });
  return { ...result, mandateId, vaultBacked, spentUsd };
}
