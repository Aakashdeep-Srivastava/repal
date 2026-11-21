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
 * and customer cashback accrued→payable. Scopeable to one merchant.
 *
 * Phase 3 gate: only obligations whose redemption a merchant/affiliate has CONFIRMED
 * (`Redemption.confirmedAt` set by `confirmRedemption`) and that is not reversed are
 * advanced. Internal eligibility alone is NOT settleable — a commission becomes payable
 * only once the party that owes it has confirmed the redemption really happened.
 */
export async function markPayable(
  prisma: PrismaClient,
  opts: { merchantId?: string } = {},
): Promise<MarkPayableResult> {
  const merchantWhere = opts.merchantId ? { merchantId: opts.merchantId } : {};
  return prisma.$transaction(async (tx) => {
    // The confirmation gate: ids of redemptions that are merchant/affiliate-confirmed
    // and still live. updateMany can't filter on a relation across every Prisma version,
    // so resolve the id set first, then scope the obligation updates to it.
    const confirmed = await tx.redemption.findMany({
      where: { ...merchantWhere, confirmedAt: { not: null }, status: { not: "reversed" } },
      select: { id: true },
    });
    const ids = confirmed.map((r) => r.id);
    if (ids.length === 0) return { commissionsMarked: 0, cashbackMarked: 0 };

    const commissions = await tx.commissionLedger.updateMany({
      where: { redemptionId: { in: ids }, party: "publisher", status: "pending" },
      data: { status: "payable" },
    });
    const cashback = await tx.customerRewardLedger.updateMany({
      where: { redemptionId: { in: ids }, status: "accrued" },
      data: { status: "payable" },
    });
    return { commissionsMarked: commissions.count, cashbackMarked: cashback.count };
  });
}
