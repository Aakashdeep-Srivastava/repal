/**
 * recordRedemption — the core commercial event. Called AFTER a purchase has
 * captured + a signed receipt exists; records that a validated coupon was
 * applied to a real sale and books everything PayPal does not: the discount
 * against the campaign budget, the commission (RePal + publisher share), the
 * attribution, and any customer cashback liability.
 *
 * Runs in a single transaction so `one_time_use` can be enforced race-free (a
 * user holds at most one non-reversed redemption per offer). DETERMINISTIC money
 * — the commission/cashback amounts come from lib/ledger/commission.ts, never an
 * LLM. OWNER: commercial ledger.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import {
  computeCommission,
  computeCashbackCents,
  DEFAULT_REPAL_FEE_BPS,
  type CommissionSplit,
} from "./commission";

export class RedemptionError extends Error {
  constructor(
    public code: "already_redeemed" | "invalid_code" | "missing_amounts",
    message: string,
  ) {
    super(message);
    this.name = "RedemptionError";
  }
}

export interface RecordRedemptionInput {
  userId: string;
  merchantId: string;
  /** Pre-discount price, in cents. */
  grossCents: number;
  /** What PayPal actually moved, in cents (the attributed GMV commission base). */
  netPaidCents: number;
  /** Face value of the discount RePal's ledger accounts for, in cents. */
  discountCents: number;
  rewardId?: string;
  /** CatalogOffer id — resolves code / type / campaign / publisher / one_time_use. */
  offerId?: string;
  receiptId?: string;
  /** Coupon code presented; validated against the offer's code when it has one. */
  code?: string;
  /** Overrides when there is no CatalogOffer row (e.g. an ingested reward). */
  publisherId?: string;
  campaignId?: string;
  cashbackCents?: number;
}

export interface RedemptionResult {
  redemptionId: string;
  commission: CommissionSplit;
  cashbackCents: number;
  publisherId: string | null;
  campaignId: string | null;
}

function hasOneTimeUse(rules: Prisma.JsonValue | null | undefined): boolean {
  return (
    Array.isArray(rules) &&
    rules.some((r) => r != null && typeof r === "object" && (r as { predicate?: unknown }).predicate === "one_time_use")
  );
}

export async function recordRedemption(
  prisma: PrismaClient,
  input: RecordRedemptionInput,
): Promise<RedemptionResult> {
  if (!Number.isInteger(input.grossCents) || !Number.isInteger(input.netPaidCents) || !Number.isInteger(input.discountCents)) {
    throw new RedemptionError("missing_amounts", "gross/net/discount must be integer cents");
  }

  // This transaction does ~10 sequential round-trips; give it headroom beyond
  // Prisma's 5s default so a cold compute / pooled (PgBouncer) connection can't
  // trip P2028 ("transaction not found") mid-write.
  return prisma.$transaction(async (tx) => {
    // 1. Resolve the offer (if any) for code / type / campaign / publisher / rules.
    const offer = input.offerId
      ? await tx.catalogOffer.findUnique({ where: { id: input.offerId } })
      : null;

    const publisherId = input.publisherId ?? offer?.publisherId ?? null;
    const campaignId = input.campaignId ?? offer?.campaignId ?? null;

    // 2. Coupon-code validation: when the offer carries a code and the caller
    //    presents a different one, reject. (RePal validates the coupon here — not
    //    PayPal.)
    if (offer?.code && input.code && offer.code !== input.code) {
      throw new RedemptionError("invalid_code", `coupon code does not match offer ${offer.id}`);
    }

    // 3. one_time_use: at most one non-reversed redemption per (user, offer).
    if (input.offerId && hasOneTimeUse(offer?.rules)) {
      const prior = await tx.redemption.findFirst({
        where: { userId: input.userId, offerId: input.offerId, status: { not: "reversed" } },
        select: { id: true },
      });
      if (prior) {
        throw new RedemptionError("already_redeemed", `offer ${input.offerId} already redeemed by ${input.userId}`);
      }
    }

    // 4. Commission terms: the publisher's active agreement (merchant-specific
    //    beats a global one), else RePal's default fee with no publisher share.
    let repalFeeBps = DEFAULT_REPAL_FEE_BPS;
    let revShareBps = 0;
    if (publisherId) {
      const agreement = await tx.partnerAgreement.findFirst({
        where: {
          publisherId,
          status: "active",
          OR: [{ merchantId: input.merchantId }, { merchantId: null }],
        },
        orderBy: { merchantId: "desc" }, // non-null (merchant-specific) sorts before null
      });
      if (agreement) {
        repalFeeBps = agreement.repalFeeBps;
        revShareBps = agreement.revShareBps;
      }
    }
    const commission = computeCommission(input.netPaidCents, repalFeeBps, revShareBps);

    // 5. Cashback accrual (explicit override, else derived from the offer type).
    const cashbackCents =
      input.cashbackCents ??
      (offer
        ? computeCashbackCents(
            offer.type,
            offer.value,
            input.netPaidCents,
            offer.maxRewardUsd != null ? Math.round(offer.maxRewardUsd * 100) : null,
          )
        : 0);

    // 6. The redemption row.
    const redemption = await tx.redemption.create({
      data: {
        userId: input.userId,
        rewardId: input.rewardId ?? null,
        offerId: input.offerId ?? null,
        merchantId: input.merchantId,
        campaignId,
        receiptId: input.receiptId ?? null,
        code: input.code ?? offer?.code ?? null,
        discountCents: input.discountCents,
        grossCents: input.grossCents,
        netPaidCents: input.netPaidCents,
        status: "redeemed",
      },
    });

    // 7. Attribution — provenance for the publisher's revenue share.
    if (publisherId) {
      await tx.attribution.create({
        data: {
          redemptionId: redemption.id,
          publisherId,
          merchantId: input.merchantId,
          model: input.code || offer?.code ? "coupon_code" : "last_touch",
        },
      });
    }

    // 8. Commission ledger: RePal's net, plus the publisher's carved-out share.
    await tx.commissionLedger.create({
      data: {
        redemptionId: redemption.id,
        party: "repal",
        merchantId: input.merchantId,
        amountCents: commission.repalNetCents,
        status: "pending",
      },
    });
    if (publisherId && commission.publisherCents > 0) {
      await tx.commissionLedger.create({
        data: {
          redemptionId: redemption.id,
          party: "publisher",
          publisherId,
          merchantId: input.merchantId,
          amountCents: commission.publisherCents,
          status: "pending",
        },
      });
    }

    // 9. Deplete the campaign's discount budget (the brand funds the discount).
    if (campaignId) {
      const campaign = await tx.campaignBudget.update({
        where: { id: campaignId },
        data: { spentCents: { increment: input.discountCents } },
      });
      if (campaign.spentCents >= campaign.budgetCents && campaign.status === "active") {
        await tx.campaignBudget.update({ where: { id: campaignId }, data: { status: "exhausted" } });
      }
    }

    // 10. Customer cashback liability (reward obligation), if this offer earns it.
    if (cashbackCents > 0) {
      await tx.customerRewardLedger.create({
        data: {
          userId: input.userId,
          redemptionId: redemption.id,
          merchantId: input.merchantId,
          amountCents: cashbackCents,
          status: "accrued",
        },
      });
    }

    return {
      redemptionId: redemption.id,
      commission,
      cashbackCents,
      publisherId,
      campaignId,
    };
  }, { timeout: 15_000, maxWait: 5_000 });
}
