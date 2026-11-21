/**
 * Campaign performance reporting (Phase 4 pilot metrics).
 *
 * `summariseCampaign` is PURE (unit-tested): given a campaign and its ledger rows it
 * returns the pilot metrics. The three value types the roadmap forbids combining —
 * cash commission, customer cashback liability, and non-cash media credits — are kept
 * as SEPARATE fields and never summed into one balance. All integer cents.
 *
 * Honesty: `confirmationRate` is confirmed ÷ recorded redemptions, NOT a true redemption
 * rate (that needs distribution/impression data RePal does not yet have). `merchantSpend`
 * and `gmv` are reported as-is; any ROI the UI derives must be labelled against a
 * reference pilot, not real partner economics.
 */

export interface CampaignRow {
  id: string;
  name: string;
  merchantId: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  mediaCreditCents: number;
}
export interface RedemptionRow {
  campaignId: string | null;
  status: string; // redeemed | reversed
  confirmedAt: Date | null;
  netPaidCents: number;
  discountCents: number;
}
export interface CommissionRow {
  redemptionId: string;
  party: string; // repal | publisher
  amountCents: number;
  status: string; // pending | payable | paid | reversed
}
export interface CashbackRow {
  amountCents: number;
  status: string; // accrued | payable | paid | reversed
}

export interface CampaignReport {
  campaignId: string;
  name: string;
  merchantId: string;
  status: string;
  // Budget (the brand's discount funding).
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  // Redemptions.
  redemptionsRecorded: number; // non-reversed
  redemptionsConfirmed: number; // merchant/affiliate-confirmed
  confirmationRate: number; // confirmed / recorded, 0..1 (NOT a true redemption rate)
  // Volume (confirmed only — unconfirmed is not yet real revenue).
  gmvCents: number; // net paid by buyers on confirmed redemptions
  discountGivenCents: number; // discount applied on confirmed redemptions
  // Cash commission (RePal's take + the publisher's share that is payable).
  commissionRepalCents: number;
  commissionPublisherPayableCents: number;
  // SEPARATE non-cash / liability balances — never folded into the above.
  cashbackLiabilityCents: number; // owed to customers
  mediaCreditCents: number; // advertising entitlement, not cash
  // Convenience: merchant's cash outlay on confirmed volume (discount + RePal fee).
  merchantSpendCents: number;
}

function isConfirmed(r: RedemptionRow): boolean {
  return r.status !== "reversed" && r.confirmedAt != null;
}

export function summariseCampaign(
  campaign: CampaignRow,
  redemptions: RedemptionRow[],
  commissions: CommissionRow[],
  cashback: CashbackRow[],
): CampaignReport {
  const live = redemptions.filter((r) => r.status !== "reversed");
  const confirmed = live.filter(isConfirmed);

  const gmvCents = confirmed.reduce((s, r) => s + r.netPaidCents, 0);
  const discountGivenCents = confirmed.reduce((s, r) => s + r.discountCents, 0);

  const commissionRepalCents = commissions
    .filter((c) => c.party === "repal" && (c.status === "pending" || c.status === "payable" || c.status === "paid"))
    .reduce((s, c) => s + c.amountCents, 0);
  const commissionPublisherPayableCents = commissions
    .filter((c) => c.party === "publisher" && (c.status === "payable" || c.status === "paid"))
    .reduce((s, c) => s + c.amountCents, 0);

  const cashbackLiabilityCents = cashback
    .filter((c) => c.status === "accrued" || c.status === "payable")
    .reduce((s, c) => s + c.amountCents, 0);

  return {
    campaignId: campaign.id,
    name: campaign.name,
    merchantId: campaign.merchantId,
    status: campaign.status,
    budgetCents: campaign.budgetCents,
    spentCents: campaign.spentCents,
    remainingCents: Math.max(0, campaign.budgetCents - campaign.spentCents),
    redemptionsRecorded: live.length,
    redemptionsConfirmed: confirmed.length,
    confirmationRate: live.length === 0 ? 0 : confirmed.length / live.length,
    gmvCents,
    discountGivenCents,
    commissionRepalCents,
    commissionPublisherPayableCents,
    cashbackLiabilityCents,
    mediaCreditCents: campaign.mediaCreditCents,
    merchantSpendCents: discountGivenCents + commissionRepalCents,
  };
}
