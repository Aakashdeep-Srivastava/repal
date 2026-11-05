import { NextResponse } from "next/server";
import { z } from "zod";
import { issueReceipt } from "@/lib/receipts/issue";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/demo-capture — sandbox counterpart to /api/pay/capture.
 *
 * When PayPal is NOT configured, the shopping journey still needs to reach a
 * REAL, server-signed receipt (verifiable at /verify/:id). This route issues
 * exactly that receipt — the same Ed25519 signing as the live path — but with
 * DEMO PayPal ids and a response that is explicitly labelled as a sandbox
 * transaction (`demo: true`, `status: "demo_complete"`).
 *
 * Honesty contract: the receipt is genuine and verifiable, but NO live PayPal
 * capture happened. The UI must label this "Sandbox — no live PayPal capture"
 * and never present it as a real payment. Money is NOT recomputed here — the
 * decision numbers come straight from the caller (the optimizer's plan).
 *
 * OWNER: shopping journey (payment boundary).
 */
const Body = z.object({
  /** Optional idempotency hint; folded into the demo order id so repeats are attributable. */
  checkoutKey: z.string().min(1).max(128).optional(),
  decision: z.object({
    userId: z.string().min(1).max(64).optional(),
    runId: z.string().min(1),
    item: z.string().min(1),
    merchant: z.string().min(1),
    category: z.string().min(1),
    priceUsd: z.number().nonnegative(),
    savedUsd: z.number().nonnegative(),
    cashUsd: z.number().nonnegative(),
    fxInrPerUsd: z.number().optional(),
  }),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "demo-capture"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
  const { decision, checkoutKey } = parsed.data;

  // Resolve acting user: explicit → session → demo-user.
  const userId = decision.userId ?? (await getSessionUser()).userId ?? "demo-user";

  // Deterministic-ish demo ids. A caller-supplied checkoutKey makes repeated
  // POSTs stable/attributable (full dedupe is the UI's job via disabled submit).
  const suffix = checkoutKey ?? String(Date.now());
  const paypalOrderId = `DEMO-ORDER-${suffix}`;
  const paypalCaptureId = `DEMO-CAPTURE-${suffix}`;

  try {
    const receipt = await issueReceipt({
      userId,
      runId: decision.runId,
      item: decision.item,
      merchant: decision.merchant,
      category: decision.category,
      priceUsd: decision.priceUsd,
      savedUsd: decision.savedUsd,
      cashUsd: decision.cashUsd,
      ...(decision.fxInrPerUsd !== undefined ? { fxInrPerUsd: decision.fxInrPerUsd } : {}),
      paypalOrderId,
      paypalCaptureId,
    });

    return NextResponse.json(
      {
        demo: true,
        receiptId: receipt.id,
        verifyUrl: `/verify/${receipt.id}`,
        status: "demo_complete",
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "demo capture failed" },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }
}
