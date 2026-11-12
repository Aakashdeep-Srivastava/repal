import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { CATALOG } from "@/lib/merchants/catalog";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/rewards/save { offerId, savedBy? } — saves a catalog offer as the
 * user's Reward (idempotent). This is the bridge the PRD requires: the optimizer
 * only ever reads Reward rows, so an offer must become a Reward before it counts.
 * The agent calls this with savedBy:"agent" to auto-save a matching offer before
 * checkout. The Terms agent fills `rules` asynchronously; it starts empty.
 */
const Body = z.object({
  offerId: z.string().min(1).max(64),
  savedBy: z.enum(["user", "agent"]).default("user"),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "rewards-save"), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: rateLimitHeaders(rl) });
  }
  const { offerId, savedBy } = parsed.data;

  const offer = CATALOG.find((o) => o.id === offerId);
  if (!offer) {
    return NextResponse.json({ error: "unknown offer" }, { status: 404, headers: rateLimitHeaders(rl) });
  }

  const { userId } = await getSessionUser();

  // Integrity gate: "locked" offers represent value the user must actually hold
  // (a gift card we find in Gmail, a linked card's card-linked offer). A saved
  // offer becomes a spendable Reward the optimizer acts on, so a direct POST
  // must NOT be able to fabricate one before the connection exists. The UI hides
  // Save on these; this enforces it server-side too.
  if (offer.audience === "requires_gmail" || offer.audience === "requires_card") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gmailLinked: true, cardLinked: true },
    });
    const unlocked = offer.audience === "requires_gmail" ? user?.gmailLinked : user?.cardLinked;
    if (!unlocked) {
      return NextResponse.json(
        {
          error:
            offer.audience === "requires_gmail"
              ? "Connect Gmail to claim this reward"
              : "Link a card to claim this reward",
        },
        { status: 403, headers: rateLimitHeaders(rl) },
      );
    }
  }

  // Idempotent: saving the same offer twice returns the existing Reward.
  const existing = await prisma.reward.findFirst({ where: { userId, offerId } });
  if (existing) {
    return NextResponse.json(existing, { headers: rateLimitHeaders(rl) });
  }

  const reward = await prisma.reward.create({
    data: {
      userId,
      offerId,
      merchantId: offer.merchantId,
      savedBy,
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

  return NextResponse.json(reward, { status: 201, headers: rateLimitHeaders(rl) });
}
