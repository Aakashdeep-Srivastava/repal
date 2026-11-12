import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rankOffers, groupFeed, type RankedOffer, type UserContext } from "@/lib/offers/rank";
import { merchantById, type Category } from "@/lib/merchants/catalog";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/rewards/feed — the cold-start wallet feed for the current user,
 * grouped {welcome, forYou, locked, popular}. Deterministic (no LLM): ranking
 * runs over the code catalog using the user's onboarding interests + any saved
 * offers + receipt history. A brand-new user with zero history still gets a
 * full feed. See lib/offers/rank.ts.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "rewards-feed"), 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { userId } = await getSessionUser();
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const [saved, receipts] = await Promise.all([
    prisma.reward.findMany({ where: { userId, offerId: { not: null } }, select: { offerId: true } }),
    prisma.receipt.findMany({ where: { userId }, select: { merchant: true, category: true } }),
  ]);

  const ctx: UserContext = {
    daysSinceSignup: user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000) : 0,
    country: user?.country === "IN" ? "IN" : "US",
    interests: (user?.interests ?? []) as Category[],
    connections: { gmail: user?.gmailLinked ?? false, card: user?.cardLinked ?? false },
    savedOfferIds: saved.map((r) => r.offerId).filter((x): x is string => Boolean(x)),
    merchantsOrderedFrom: receipts.map((r) => r.merchant),
    historyCategories: receipts.map((r) => r.category as Category),
  };

  const withMerchant = (list: RankedOffer[]) =>
    list.map((r) => ({ ...r, merchant: merchantById[r.offer.merchantId], isSample: r.offer.source !== "repal" }));
  const g = groupFeed(rankOffers(ctx));

  return NextResponse.json(
    {
      onboarded: Boolean(user?.onboardedAt),
      welcome: withMerchant(g.welcome),
      forYou: withMerchant(g.forYou),
      locked: withMerchant(g.locked),
      popular: withMerchant(g.popular),
    },
    { headers: rateLimitHeaders(rl) },
  );
}
