import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { runIngestion } from "@/lib/ingest/registry";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/wallet/ingest — the PRD's connect-source entry point (§15).
 *
 * Collects rewards from every source adapter (gmail / paypal / card / loyalty /
 * channel3), parses their T&Cs, and idempotently writes them to the user's
 * wallet. Returns an IngestSummary with per-source + aggregate counts.
 *
 * userId precedence: body.userId > session user > "demo-user".
 * OWNER: AI agents layer (ingestion).
 */

// Inline schema (lib/schemas.ts is owned by another agent — do not touch it).
const IngestBodySchema = z.object({
  userId: z.string().min(1).optional(),
  sources: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  // Ingestion fans out to Gmail/LLM work — keep it tight.
  const rl = rateLimit(clientKey(req, "wallet-ingest"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = IngestBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionUser = await getSessionUser();
  const userId = parsed.data.userId ?? sessionUser.userId ?? "demo-user";

  const summary = await runIngestion(userId, parsed.data.sources);
  return NextResponse.json(summary);
}
