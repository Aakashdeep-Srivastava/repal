import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { summariseCampaign, type CampaignReport } from "@/lib/ledger/campaign-report";

/**
 * GET /api/insights/campaigns — live Phase 4 pilot reporting from the commercial
 * ledger. Per campaign: budget vs spend, recorded vs merchant-confirmed redemptions,
 * confirmed GMV, cash commission, and — kept strictly separate — customer cashback
 * liability and non-cash media credits. Deterministic; reads the ledger, computes no money.
 */
export async function GET() {
  try {
    const campaigns = await prisma.campaignBudget.findMany({ orderBy: { name: "asc" } });

    const reports: CampaignReport[] = [];
    for (const c of campaigns) {
      const redemptions = await prisma.redemption.findMany({
        where: { campaignId: c.id },
        select: { id: true, campaignId: true, status: true, confirmedAt: true, netPaidCents: true, discountCents: true },
      });
      const ids = redemptions.map((r) => r.id);
      const [commissions, cashback] = await Promise.all([
        ids.length
          ? prisma.commissionLedger.findMany({
              where: { redemptionId: { in: ids } },
              select: { redemptionId: true, party: true, amountCents: true, status: true },
            })
          : Promise.resolve([]),
        ids.length
          ? prisma.customerRewardLedger.findMany({
              where: { redemptionId: { in: ids } },
              select: { amountCents: true, status: true },
            })
          : Promise.resolve([]),
      ]);
      reports.push(summariseCampaign(c, redemptions, commissions, cashback));
    }

    const totals = reports.reduce(
      (t, r) => ({
        gmvCents: t.gmvCents + r.gmvCents,
        commissionRepalCents: t.commissionRepalCents + r.commissionRepalCents,
        redemptionsConfirmed: t.redemptionsConfirmed + r.redemptionsConfirmed,
      }),
      { gmvCents: 0, commissionRepalCents: 0, redemptionsConfirmed: 0 },
    );

    return NextResponse.json({ campaigns: reports, totals });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "campaign report failed" },
      { status: 500 },
    );
  }
}
