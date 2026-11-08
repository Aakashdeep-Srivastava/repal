import { prisma } from "@/lib/db";
import { createPayout } from "@/lib/paypal/payouts";
import { issueReceipt } from "@/lib/receipts/issue";

/**
 * liberateReward — the shared reward→cash primitive used by both
 * POST /api/pay/payout and the agent's `payout` tool.
 *
 * Validates/bounds the reward, calls PayPal Payouts, persists a Payout row + a
 * signed verifiable receipt, and marks the reward `liberated` (no double-cash).
 * Deterministic: amounts come from the reward, never the LLM.
 */
export class LiberateError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LiberateError";
  }
}

export interface LiberateInput {
  userId: string;
  rewardId?: string;
  amountUsd: number;
  receiverEmail: string;
  note?: string;
}

export interface LiberateResult {
  payoutBatchId: string;
  amountUsd: number;
  receiptId: string;
  verifyUrl: string;
  status?: string;
}

export async function liberateReward(input: LiberateInput): Promise<LiberateResult> {
  let amountUsd = input.amountUsd;
  let item = "Reward cash-out";

  if (input.rewardId) {
    const reward = await prisma.reward.findFirst({
      where: { id: input.rewardId, userId: input.userId },
    });
    if (!reward) throw new LiberateError("reward not found", 404);
    if (reward.status === "liberated") throw new LiberateError("reward already cashed out", 409);
    amountUsd = Math.min(amountUsd, reward.valueUsd);
    item = reward.termsRaw.slice(0, 80) || item;
  }

  // Throws on a PayPal error (e.g. sender-country restriction) — the caller maps
  // that to a 502 / an agent-visible failure. No DB writes happen before this.
  const result = await createPayout({ receiverEmail: input.receiverEmail, amountUsd, note: input.note });
  const payoutBatchId = result.batch_header.payout_batch_id;

  const receipt = await issueReceipt({
    userId: input.userId,
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
      userId: input.userId,
      rewardId: input.rewardId ?? null,
      receiptId: receipt.id,
      amountUsd,
      receiverEmail: input.receiverEmail,
      payoutBatchId,
      status: result.batch_header.batch_status ?? "PENDING",
    },
  });

  if (input.rewardId) {
    await prisma.reward.update({ where: { id: input.rewardId }, data: { status: "liberated" } });
  }

  return {
    payoutBatchId,
    amountUsd,
    receiptId: receipt.id,
    verifyUrl: `/verify/${receipt.id}`,
    status: result.batch_header.batch_status,
  };
}
