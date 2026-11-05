import { NextResponse } from "next/server";
import { planPurchase } from "@/lib/pipeline";
import { PlanInputSchema } from "@/lib/schemas";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/plan — the deterministic cart pipeline, exposed directly (no LLM).
 *
 * Runs wallet + mandate (DB) → offers (cache/Channel3) → optimizer → policy
 * gate and returns up to 3 ranked plans + rejections. This is the money-math
 * the orchestrator's `plan_purchase` tool calls; exposing it lets the UI show
 * "cheapest after rewards" plans without waiting on the LLM. OWNER: Aakash.
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "plan"), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = PlanInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
  try {
    const result = await planPurchase(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Channel3 not configured (and no cached offers) is an expected pre-launch state.
    const needsOffers = /channel3|api key|CHANNEL3/i.test(message);
    return NextResponse.json(
      { error: message, needsOffers },
      { status: needsOffers ? 200 : 500 },
    );
  }
}
