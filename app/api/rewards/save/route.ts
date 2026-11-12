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
