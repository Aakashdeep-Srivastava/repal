/**
 * Settlement — advancing earned commission and accrued cashback toward payout.
 *
 * `summarisePayable` is PURE (unit-tested): it totals what is owed, per purpose.
 * `markPayable` is the DB step that moves pending/accrued entries to `payable`
 * (the state a payout run consumes). The actual PayPal Payouts call is NOT made
 * here — it is gated on a US sandbox sender account (see lib/payout/liberate.ts
 * and docs/PAYPAL_SANDBOX.md), the same external limitation that blocks live
 * payouts today. Creating the PayoutBatch/PayoutItem rows + invoking PayPal is
 * the next hook once that account exists. OWNER: commercial ledger.
 */
import type { PrismaClient } from "@prisma/client";

export interface PayableSummary {
  publisherCommissionCents: number;
  customerCashbackCents: number;
  totalCents: number;
}

/** Total currently-payable amounts by purpose. PURE — no DB. */
export function summarisePayable(
  commissions: { party: string; status: string; amountCents: number }[],
  cashback: { status: string; amountCents: number }[],
): PayableSummary {
  const publisherCommissionCents = commissions
    .filter((c) => c.party === "publisher" && (c.status === "pending" || c.status === "payable"))
    .reduce((s, c) => s + c.amountCents, 0);
  const customerCashbackCents = cashback
    .filter((c) => c.status === "accrued" || c.status === "payable")
    .reduce((s, c) => s + c.amountCents, 0);
  return {
    publisherCommissionCents,
    customerCashbackCents,
    totalCents: publisherCommissionCents + customerCashbackCents,
  };
}

export interface MarkPayableResult {
  commissionsMarked: number;
  cashbackMarked: number;
}

/**
 * Advance settled obligations to `payable`: publisher commissions pending→payable
 * and customer cashback accrued→payable. Only entries whose redemption is still
 * live (not reversed) are advanced. Scopeable to one merchant.
 */
export async function markPayable(
  prisma: PrismaClient,
  opts: { merchantId?: string } = {},
): Promise<MarkPayableResult> {
  const merchantWhere = opts.merchantId ? { merchantId: opts.merchantId } : {};
  return prisma.$transaction(async (tx) => {
    const commissions = await tx.commissionLedger.updateMany({
      where: { ...merchantWhere, party: "publisher", status: "pending" },
      data: { status: "payable" },
    });
    const cashback = await tx.customerRewardLedger.updateMany({
      where: { ...merchantWhere, status: "accrued" },
      data: { status: "payable" },
    });
    return { commissionsMarked: commissions.count, cashbackMarked: cashback.count };
  });
}
