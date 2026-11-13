import { NextResponse } from "next/server";
import { z } from "zod";
import { liberateReward, LiberateError } from "@/lib/payout/liberate";
import { requireUserId, UnauthorizedError } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/payout — REWARD LIBERATION: turn a reward into real (sandbox)
 * PayPal balance. The signature RePal beat. All logic lives in
 * lib/payout/liberate (shared with the agent's `payout` tool).
 *
 * Not mandate-gated — it moves the user's OWN reward value to them. Bounded to
 * the reward's value; the reward is marked `liberated` to prevent double-cash.
 */
const Body = z.object({
  receiverEmail: z.string().email(),
  amountUsd: z.number().positive().max(100_000),
  // rewardId is REQUIRED: a payout must always be backed by a reward the user
  // owns, and the amount is bounded server-side to that reward's value.
  rewardId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "payout"), 10, 60_000);
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
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in to cash out a reward." }, { status: 401, headers: rateLimitHeaders(rl) });
    }
    throw e;
  }

  try {
    const result = await liberateReward({ userId, ...parsed.data });
    return NextResponse.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    const status = err instanceof LiberateError ? err.status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "payout failed" },
      { status, headers: rateLimitHeaders(rl) },
    );
  }
}
