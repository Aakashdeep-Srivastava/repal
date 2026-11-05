import { NextResponse } from "next/server";
import { z } from "zod";
import { planPurchase } from "@/lib/pipeline";

/**
 * POST /api/plan — the deterministic cart pipeline, exposed directly (no LLM).
 *
 * Runs wallet + mandate (DB) → offers (cache/Channel3) → optimizer → policy
 * gate and returns up to 3 ranked plans + rejections. This is the money-math
 * the orchestrator's `plan_purchase` tool calls; exposing it lets the UI show
 * "cheapest after rewards" plans without waiting on the LLM. OWNER: Aakash.
 */
const Body = z.object({
  userId: z.string().default("demo-user"),
  category: z.string().min(1),
  maxPriceUsd: z.number().positive().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
