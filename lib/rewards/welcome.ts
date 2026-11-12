import { prisma } from "@/lib/db";
import { CATALOG } from "@/lib/merchants/catalog";

/**
 * Grant the RePal welcome reward ($5 on the first agent purchase) to a user,
 * idempotently. This is what keeps a brand-new "Log in with PayPal" user's
 * wallet from starting at $0 — it's an HONEST reward (a genuine RePal-funded
 * welcome bonus from the catalog), not a fabricated gift card. The optimizer
 * reads Reward rows, so this is a real, spendable welcome credit.
 *
 * No-op if the user already has it. Safe to call on every login.
 */
export async function grantWelcomeReward(userId: string) {
  const offer = CATALOG.find((o) => o.id === "welcome-5");
  if (!offer) return null;

  const existing = await prisma.reward.findFirst({ where: { userId, offerId: offer.id } });
  if (existing) return existing;

  return prisma.reward.create({
    data: {
      userId,
      offerId: offer.id,
      merchantId: offer.merchantId,
      savedBy: "system",
      source: offer.source,
      type: offer.type,
      valueUsd: offer.value,
      termsRaw: offer.termsRaw,
      rules: {}, // Terms agent fills this asynchronously
      parseConfidence: 0,
      status: "saved",
      expiresAt: new Date(Date.now() + offer.expiresInDays * 86_400_000),
    },
  });
}
