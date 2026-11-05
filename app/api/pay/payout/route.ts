import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayout } from "@/lib/paypal/payouts";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/** POST /api/pay/payout — reward liberation to the user's PayPal balance. */
const Body = z.object({
  receiverEmail: z.string().email(),
  amountUsd: z.number().positive().max(100_000),
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
  try {
    const result = await createPayout(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "payout failed" },
      { status: 502 },
    );
  }
}
