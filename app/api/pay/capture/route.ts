import { NextResponse } from "next/server";
import { z } from "zod";
import { captureOrder } from "@/lib/paypal/orders";
import { issueReceipt } from "@/lib/receipts/issue";
import { gateSpend } from "@/lib/policy/gate";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/capture — capture an approved order and issue the signed
 * decision receipt. The money lifecycle's final two legs: PayPal moves the cash,
 * then RePal records a tamper-evident receipt verifiable at /verify/:id.
 *
 * `decision` carries the plan numbers the receipt attests to (deterministic,
 * from the optimizer — never recomputed here). OWNER: Aakash.
 */
const Body = z.object({
  orderId: z.string().min(1),
  decision: z
    .object({
      userId: z.string().min(1).max(64).default("demo-user"),
      runId: z.string().min(1),
      item: z.string().min(1),
      merchant: z.string().min(1),
      category: z.string().min(1),
      priceUsd: z.number().nonnegative(),
      savedUsd: z.number().nonnegative(),
      cashUsd: z.number().nonnegative(),
      payoutBatchId: z.string().optional(),
      fxInrPerUsd: z.number().optional(),
      /** Explicit human approval — required when policy returns "ask". */
      approved: z.boolean().optional(),
    })
    .optional(),
});

/** Pull the capture id out of the Orders v2 capture response (defensive). */
function captureIdOf(result: unknown, fallback: string): string {
  const r = result as {
    purchase_units?: { payments?: { captures?: { id?: string }[] } }[];
  };
  return r?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? fallback;
}

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "capture"), 10, 60_000);
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
  const { orderId, decision } = parsed.data;

  try {
    // SECOND policy check — gate against the real active mandate BEFORE money
    // moves. deny → refuse; ask → require explicit approval. (No decision = a
    // bare capture with no receipt; nothing to gate.)
    if (decision) {
      const gate = await gateSpend({
        userId: decision.userId,
        category: decision.category,
        merchant: decision.merchant,
        cashUsd: decision.cashUsd,
      });
      if (gate.decision === "deny") {
        return NextResponse.json(
          { error: "Blocked by your spending mandate.", policy: gate },
          { status: 403, headers: rateLimitHeaders(rl) },
        );
      }
      if (gate.decision === "ask" && !decision.approved) {
        return NextResponse.json(
          { needsApproval: true, policy: gate },
          { status: 409, headers: rateLimitHeaders(rl) },
        );
      }
    }

    const capture = await captureOrder(orderId);

    if (!decision) {
      return NextResponse.json({ capture });
    }

    const captureId = captureIdOf(capture, orderId);
    const receipt = await issueReceipt({
      ...decision,
      paypalOrderId: orderId,
      paypalCaptureId: captureId,
    });
    return NextResponse.json({ capture, receiptId: receipt.id, verifyUrl: `/verify/${receipt.id}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "capture failed" },
      { status: 502 },
    );
  }
}
