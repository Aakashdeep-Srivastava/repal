import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayout } from "@/lib/paypal/payouts";
import { issueReceipt } from "@/lib/receipts/issue";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/pay/payout — REWARD LIBERATION: turn a stuck/unused reward into real
 * (sandbox) PayPal balance. The signature RePal beat.
 *
 * Unlike a purchase, a payout moves the user's OWN reward value to them, so it is
 * not gated by the spending mandate. It IS bounded by the reward's value and the
 * reward is marked `liberated` so it can't be cashed out twice. Every payout is
 * persisted (Payout row) and gets a signed, verifiable receipt (/verify/:id) —
 * previously the payout was fire-and-forget.
 */
const Body = z.object({
  receiverEmail: z.string().email(),
  amountUsd: z.number().positive().max(100_000),
  rewardId: z.string().optional(),
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
  const { receiverEmail, rewardId, note } = parsed.data;
  const { userId } = await getSessionUser();

  // If tied to a reward: it must belong to the user and be active; bound the
  // amount to its value and prevent double-liberation.
  let amountUsd = parsed.data.amountUsd;
  let item = "Reward cash-out";
  if (rewardId) {
    const reward = await prisma.reward.findFirst({ where: { id: rewardId, userId } });
    if (!reward) {
      return NextResponse.json({ error: "reward not found" }, { status: 404, headers: rateLimitHeaders(rl) });
    }
    if (reward.status === "liberated") {
      return NextResponse.json({ error: "reward already cashed out" }, { status: 409, headers: rateLimitHeaders(rl) });
    }
    amountUsd = Math.min(amountUsd, reward.valueUsd);
    item = reward.termsRaw.slice(0, 80) || item;
  }

  try {
    const result = await createPayout({ receiverEmail, amountUsd, note });
    const payoutBatchId = result.batch_header.payout_batch_id;

    // Signed, verifiable receipt for the liberation (no order/capture — use the
    // batch id as the money anchor).
    const receipt = await issueReceipt({
      userId,
      runId: `payout-${payoutBatchId}`,
      item,
      merchant: "PayPal (payout)",
      category: "reward-liberation",
      priceUsd: amountUsd,
      savedUsd: 0,
      cashUsd: amountUsd,
      paypalOrderId: `PAYOUT-${payoutBatchId}`,
      paypalCaptureId: payoutBatchId,
      payoutBatchId,
    });

    await prisma.payout.create({
      data: {
        userId,
        rewardId: rewardId ?? null,
        receiptId: receipt.id,
        amountUsd,
        receiverEmail,
        payoutBatchId,
        status: result.batch_header.batch_status ?? "PENDING",
      },
    });

    if (rewardId) {
      await prisma.reward.update({ where: { id: rewardId }, data: { status: "liberated" } });
    }

    return NextResponse.json(
      {
        payoutBatchId,
        amountUsd,
        receiptId: receipt.id,
        verifyUrl: `/verify/${receipt.id}`,
        status: result.batch_header.batch_status,
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "payout failed" },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }
}
