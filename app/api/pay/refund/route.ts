import { NextResponse } from "next/server";
import { z } from "zod";
import { refundCapture } from "@/lib/paypal/refunds";
import { issueReceipt } from "@/lib/receipts/issue";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/refund — reverse a capture (full or partial), persist the
 * reversal (Refund row, status updated later by the PAYMENT.CAPTURE.REFUNDED
 * webhook), and issue a signed reversal receipt when the amount is known.
 */
const Body = z.object({
  captureId: z.string().min(1),
  amountUsd: z.number().positive().optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "refund"), 10, 60_000);
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
  const { captureId, amountUsd } = parsed.data;
  const { userId } = await getSessionUser();

  try {
    const result = await refundCapture(captureId, amountUsd);

    let receiptId: string | undefined;
    if (amountUsd !== undefined) {
      const receipt = await issueReceipt({
        userId,
        runId: `refund-${result.id}`,
        item: "Refund (reversal)",
        merchant: "PayPal (refund)",
        category: "reversal",
        priceUsd: amountUsd,
        savedUsd: 0,
        cashUsd: amountUsd,
        paypalOrderId: `REFUND-${result.id}`,
        paypalCaptureId: captureId,
      });
      receiptId = receipt.id;
    }

    await prisma.refund.create({
      data: {
        userId,
        captureId,
        receiptId: receiptId ?? null,
        refundId: result.id,
        amountUsd: amountUsd ?? null,
        status: result.status ?? "PENDING",
      },
    });

    return NextResponse.json(
      {
        refundId: result.id,
        status: result.status,
        ...(receiptId ? { receiptId, verifyUrl: `/verify/${receiptId}` } : {}),
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "refund failed" },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }
}
