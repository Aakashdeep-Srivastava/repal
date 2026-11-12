import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/rewards/onboard { interests, country? } — records the 3-tap
 * interest picks that personalise a brand-new user's feed (no history needed)
 * and stamps onboardedAt. Idempotent; re-posting updates the picks.
 */
const CATEGORIES = [
  "electronics", "groceries", "dining", "coffee", "travel", "fashion",
  "beauty", "home", "pets", "streaming", "rides", "marketplace",
] as const;

const Body = z.object({
  interests: z.array(z.enum(CATEGORIES)).min(1).max(5),
  country: z.enum(["US", "IN"]).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "rewards-onboard"), 10, 60_000);
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
  const { interests, country } = parsed.data;
  const { userId } = await getSessionUser();

  const user = await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, interests, country: country ?? "US", onboardedAt: new Date() },
    update: { interests, ...(country ? { country } : {}), onboardedAt: new Date() },
    select: { id: true, interests: true, country: true, onboardedAt: true },
  });

  return NextResponse.json(user, { headers: rateLimitHeaders(rl) });
}
