/**
 * reverseRedemption — unwind the commercial books when a purchase is refunded or
 * cancelled. Marks the redemption reversed, reverses any commission and cashback
 * that has NOT already been paid out (a paid-out entry stays — money has left),
 * and restores the discount to the campaign budget. Atomic. OWNER: commercial
 * ledger.
 */
import type { PrismaClient } from "@prisma/client";

export interface ReverseResult {
  redemptionId: string;
  commissionsReversed: number;
  cashbackReversed: number;
  budgetRestoredCents: number;
}

export async function reverseRedemption(
  prisma: PrismaClient,
  redemptionId: string,
  reason: string,
): Promise<ReverseResult> {
  return prisma.$transaction(async (tx) => {
    const redemption = await tx.redemption.findUnique({ where: { id: redemptionId } });
    if (!redemption) throw new Error(`reverseRedemption: unknown redemption ${redemptionId}`);
    if (redemption.status === "reversed") {
      return { redemptionId, commissionsReversed: 0, cashbackReversed: 0, budgetRestoredCents: 0 };
    }

    await tx.redemption.update({
      where: { id: redemptionId },
      // Null the oneTimeKey so a refunded one-time offer frees up for re-redemption.
      data: { status: "reversed", reversedReason: reason, oneTimeKey: null },
    });

    // Reverse commission/cashback that has not yet been paid (paid money is gone).
    const { count: commissionsReversed } = await tx.commissionLedger.updateMany({
      where: { redemptionId, status: { in: ["pending", "payable"] } },
      data: { status: "reversed" },
    });
    const { count: cashbackReversed } = await tx.customerRewardLedger.updateMany({
      where: { redemptionId, status: { in: ["accrued", "payable"] } },
      data: { status: "reversed" },
    });

    // Restore the discount to the campaign budget; re-open it if it had exhausted.
    let budgetRestoredCents = 0;
    if (redemption.campaignId) {
      const campaign = await tx.campaignBudget.update({
        where: { id: redemption.campaignId },
        data: { spentCents: { decrement: redemption.discountCents } },
      });
      budgetRestoredCents = redemption.discountCents;
      if (campaign.status === "exhausted" && campaign.spentCents < campaign.budgetCents) {
        await tx.campaignBudget.update({
          where: { id: redemption.campaignId },
          data: { status: "active" },
        });
      }
    }

    return { redemptionId, commissionsReversed, cashbackReversed, budgetRestoredCents };
  }, { timeout: 15_000, maxWait: 5_000 });
}
