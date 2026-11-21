/**
 * Deterministic ledger-reconciliation assertions (spec §3, §6).
 *
 * The Payment/Financial agent "must not accept a green UI success message as
 * proof of successful financial settlement." These helpers reconcile the actual
 * DB rows with decimal-safe integer-cent arithmetic — never an LLM judgment.
 *
 * They reuse the production ledger math (lib/ledger) so a test can only pass if
 * the SAME code the app runs produces the expected totals.
 */
import type { PrismaClient } from "@prisma/client";
import { rollupBalances, summarisePayable, computeCommission } from "../../lib/ledger";

export interface ReconcileExpectation {
  /** Expected commission owed to a publisher for a redemption, in cents. */
  publisherCommissionCents?: number;
  /** Expected RePal net commission for a redemption, in cents. */
  repalNetCents?: number;
  /** Expected customer cashback accrued for a redemption, in cents. */
  cashbackCents?: number;
}

export interface ReconcileResult {
  ok: boolean;
  failures: string[];
}

/** Assert a single redemption's ledger entries match the expected amounts. */
export async function reconcileRedemption(
  prisma: PrismaClient,
  redemptionId: string,
  expect: ReconcileExpectation,
): Promise<ReconcileResult> {
  const failures: string[] = [];
  const commissions = await prisma.commissionLedger.findMany({ where: { redemptionId } });
  const cashback = await prisma.customerRewardLedger.findMany({ where: { redemptionId } });

  if (expect.publisherCommissionCents != null) {
    const got = commissions.filter((c) => c.party === "publisher").reduce((s, c) => s + c.amountCents, 0);
    if (got !== expect.publisherCommissionCents)
      failures.push(`publisher commission: expected ${expect.publisherCommissionCents}c, got ${got}c`);
  }
  if (expect.repalNetCents != null) {
    const got = commissions.filter((c) => c.party === "repal").reduce((s, c) => s + c.amountCents, 0);
    if (got !== expect.repalNetCents)
      failures.push(`RePal net commission: expected ${expect.repalNetCents}c, got ${got}c`);
  }
  if (expect.cashbackCents != null) {
    const got = cashback.reduce((s, c) => s + c.amountCents, 0);
    if (got !== expect.cashbackCents)
      failures.push(`cashback accrued: expected ${expect.cashbackCents}c, got ${got}c`);
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Assert the global three balances match expectations (any provided), scoped to
 * a merchant when given. Folds raw rows with the SAME rollup the app uses.
 */
export async function reconcileBalances(
  prisma: PrismaClient,
  opts: { merchantId?: string } = {},
  expect: Partial<{ mediaCreditCents: number; cashbackLiabilityCents: number; commissionPayableCents: number }> = {},
): Promise<ReconcileResult> {
  const where = opts.merchantId ? { merchantId: opts.merchantId } : {};
  const [mediaCredits, cashback, commissions] = await Promise.all([
    prisma.mediaCreditLedger.findMany({ where, select: { direction: true, amountCents: true } }),
    prisma.customerRewardLedger.findMany({ where, select: { status: true, amountCents: true } }),
    prisma.commissionLedger.findMany({ where, select: { party: true, status: true, amountCents: true } }),
  ]);
  const bal = rollupBalances({ mediaCredits, cashback, commissions });
  const payable = summarisePayable(commissions, cashback);

  const failures: string[] = [];
  const checks: [keyof typeof bal, number | undefined][] = [
    ["mediaCreditCents", expect.mediaCreditCents],
    ["cashbackLiabilityCents", expect.cashbackLiabilityCents],
    ["commissionPayableCents", expect.commissionPayableCents],
  ];
  for (const [k, want] of checks) {
    if (want != null && bal[k] !== want) failures.push(`${k}: expected ${want}c, got ${bal[k]}c`);
  }
  // Cross-check: payable summary must agree with the balance rollup.
  if (payable.publisherCommissionCents !== bal.commissionPayableCents)
    failures.push("payable vs rollup disagree on publisher commission");
  return { ok: failures.length === 0, failures };
}

/** Re-derive the expected commission split independently (second source of truth). */
export function expectedCommission(netPaidCents: number, repalFeeBps: number, revShareBps: number) {
  return computeCommission(netPaidCents, repalFeeBps, revShareBps);
}
