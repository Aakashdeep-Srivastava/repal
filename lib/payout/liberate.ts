import { prisma } from "@/lib/db";
import { createPayout } from "@/lib/paypal/payouts";
import { newRequestId } from "@/lib/paypal/client";
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
  /** True when PayPal couldn't send (sandbox sender restriction) and we issued
   *  an honest simulated payout instead — still a real, verifiable receipt. */
  simulated?: boolean;
  /** Human-readable note explaining a simulated payout (undefined when real). */
  note?: string;
}

/**
 * A payout the SENDER account is not allowed to make — chiefly the sandbox
 * sender-country restriction (e.g. an India business account can't send Payouts;
 * PayPal returns 403 PAYOUT_NOT_AVAILABLE "You live in a country that is not
 * allowed to send this payout"). This is an account/geography limitation, not a
 * code bug, so we degrade to an honest simulated payout rather than failing.
 */
function isSenderRestricted(msg: string): boolean {
  return /PAYOUT_NOT_AVAILABLE|not allowed to send|country that is not allowed|SENDER_[A-Z_]*RESTRICT/i.test(
    msg,
  );
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

  // Attempt the real PayPal payout. A genuine failure (bad email, server error)
  // bubbles up; only a sender-country/availability restriction degrades to an
  // honest simulated payout so the demo can still complete. No DB writes happen
  // until we've resolved which path we're on.
  let payoutBatchId: string;
  let batchStatus: string | undefined;
  let simulated = false;
  let note: string | undefined;
  try {
    const result = await createPayout({ receiverEmail: input.receiverEmail, amountUsd, note: input.note });
    payoutBatchId = result.batch_header.payout_batch_id;
    batchStatus = result.batch_header.batch_status ?? "PENDING";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSenderRestricted(msg)) throw err; // real failure → let the caller map it
    simulated = true;
    payoutBatchId = `SIMULATED-PAYOUT-${newRequestId()}`;
    batchStatus = "SIMULATED";
    note =
      "Simulated payout — this sandbox account isn't allowed to send PayPal Payouts " +
      "(sender-country restriction). The receipt is genuine and verifiable; no real money moved.";
  }

  const receipt = await issueReceipt({
    userId: input.userId,
    runId: `payout-${payoutBatchId}`,
    item,
    merchant: simulated ? "PayPal (payout · simulated)" : "PayPal (payout)",
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
      status: batchStatus,
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
    status: batchStatus,
    simulated,
    note,
  };
}
