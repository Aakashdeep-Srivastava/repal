import { NextResponse } from "next/server";
import { z } from "zod";
import { eligibilityForProduct } from "@/lib/pipeline";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/eligibility — check ONE selected product against the user's reward
 * wallet (the journey's product-detail step). Runs the deterministic optimizer
 * with the product as the sole offer and returns the policy-gated plan plus the
 * rewards that didn't apply (with the disqualifying clause). No money is
 * computed here — it all comes from lib/ (eligibilityForProduct).
 */
const Body = z.object({
  userId: z.string().min(1).max(64).optional(),
  product: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    priceUsd: z.number().positive().max(1_000_000),
    retailer: z.string().min(1),
    buyUrl: z.string().default("#"),
    category: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "eligibility"), 30, 60_000);
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

  const { product } = parsed.data;
  const userId = parsed.data.userId ?? (await getSessionUser()).userId ?? "demo-user";

  try {
    const result = await eligibilityForProduct({
      userId,
      offer: {
        id: product.id,
        title: product.title,
        priceUsd: product.priceUsd,
        retailer: product.retailer,
        buyUrl: product.buyUrl,
      },
      category: product.category,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "eligibility failed" },
      { status: 500 },
    );
  }
}
