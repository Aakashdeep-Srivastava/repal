import { describe, it, expect } from "vitest";
import { summariseCampaign, type CampaignRow } from "./campaign-report";

const campaign: CampaignRow = {
  id: "camp_1",
  name: "Launch",
  merchantId: "acme",
  status: "active",
  budgetCents: 50_000,
  spentCents: 1_500,
  mediaCreditCents: 10_000,
};

describe("summariseCampaign", () => {
  it("counts only confirmed redemptions as GMV and keeps balances separate", () => {
    const r = summariseCampaign(
      campaign,
      [
        { campaignId: "camp_1", status: "redeemed", confirmedAt: new Date(), netPaidCents: 2_000, discountCents: 500 },
        { campaignId: "camp_1", status: "redeemed", confirmedAt: null, netPaidCents: 3_000, discountCents: 700 }, // not confirmed
        { campaignId: "camp_1", status: "reversed", confirmedAt: new Date(), netPaidCents: 9_999, discountCents: 999 }, // reversed
      ],
      [
        { redemptionId: "x", party: "repal", amountCents: 120, status: "pending" },
        { redemptionId: "x", party: "publisher", amountCents: 40, status: "payable" },
        { redemptionId: "y", party: "publisher", amountCents: 99, status: "pending" }, // not yet payable → excluded
      ],
      [{ amountCents: 300, status: "accrued" }],
    );

    expect(r.redemptionsRecorded).toBe(2); // reversed excluded
    expect(r.redemptionsConfirmed).toBe(1); // only the confirmed, non-reversed one
    expect(r.confirmationRate).toBeCloseTo(0.5);
    expect(r.gmvCents).toBe(2_000); // confirmed only
    expect(r.discountGivenCents).toBe(500);
    expect(r.commissionRepalCents).toBe(120);
    expect(r.commissionPublisherPayableCents).toBe(40); // pending publisher excluded
    expect(r.cashbackLiabilityCents).toBe(300);
    expect(r.mediaCreditCents).toBe(10_000); // separate, never folded in
    expect(r.remainingCents).toBe(48_500);
    expect(r.merchantSpendCents).toBe(620); // discount 500 + repal fee 120
  });

  it("is zero-safe with no redemptions", () => {
    const r = summariseCampaign(campaign, [], [], []);
    expect(r).toMatchObject({ redemptionsRecorded: 0, redemptionsConfirmed: 0, confirmationRate: 0, gmvCents: 0 });
  });
});
