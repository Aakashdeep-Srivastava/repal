/**
 * The three commercial balances the spec insists must never be conflated:
 *
 *   • mediaCredits  — non-cash advertising entitlement (NEVER paid out as money)
 *   • cashback      — customer reward liability (owed to shoppers)
 *   • commission    — partner (publisher) amounts payable
 *
 * `rollupBalances` is PURE (unit-tested); `getBalances` is the thin DB-backed
 * wrapper. All cents. OWNER: commercial ledger.
 */
import type { PrismaClient } from "@prisma/client";

export interface LedgerBalances {
  mediaCreditCents: number;
  cashbackLiabilityCents: number;
  commissionPayableCents: number;
  /** RePal's own earned commission (net of publisher share), not a liability. */
  repalEarnedCents: number;
}

export interface BalanceRows {
  mediaCredits: { direction: string; amountCents: number }[];
  cashback: { status: string; amountCents: number }[];
  commissions: { party: string; status: string; amountCents: number }[];
}

/** Fold raw ledger rows into the three balances. PURE — no DB, no I/O. */
export function rollupBalances(rows: BalanceRows): LedgerBalances {
  const mediaCreditCents = rows.mediaCredits.reduce(
    (sum, r) => sum + (r.direction === "consume" ? -r.amountCents : r.amountCents),
    0,
  );

  // Liability = not yet paid and not reversed.
  const cashbackLiabilityCents = rows.cashback
    .filter((r) => r.status === "accrued" || r.status === "payable")
    .reduce((sum, r) => sum + r.amountCents, 0);

  const commissionPayableCents = rows.commissions
    .filter((r) => r.party === "publisher" && (r.status === "pending" || r.status === "payable"))
    .reduce((sum, r) => sum + r.amountCents, 0);

  const repalEarnedCents = rows.commissions
    .filter((r) => r.party === "repal" && r.status !== "reversed")
    .reduce((sum, r) => sum + r.amountCents, 0);

  return { mediaCreditCents, cashbackLiabilityCents, commissionPayableCents, repalEarnedCents };
}

/**
 * Current commercial balances, optionally scoped to one merchant. Reads the
 * ledger tables and folds them with `rollupBalances`.
 */
export async function getBalances(
  prisma: PrismaClient,
  opts: { merchantId?: string } = {},
): Promise<LedgerBalances> {
  const where = opts.merchantId ? { merchantId: opts.merchantId } : {};
  const [mediaCredits, cashback, commissions] = await Promise.all([
    prisma.mediaCreditLedger.findMany({ where, select: { direction: true, amountCents: true } }),
    prisma.customerRewardLedger.findMany({ where, select: { status: true, amountCents: true } }),
    prisma.commissionLedger.findMany({
      where,
      select: { party: true, status: true, amountCents: true },
    }),
  ]);
  return rollupBalances({ mediaCredits, cashback, commissions });
}
