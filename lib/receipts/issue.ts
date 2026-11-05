import { prisma } from "@/lib/db";
import { signReceipt, type ReceiptInput, type SignedReceipt } from "@/lib/receipts";

/**
 * issueReceipt — sign a decision receipt (SHA-256 + Ed25519) and persist it.
 *
 * The final, deterministic step of the money lifecycle: after PayPal captures
 * (and optionally pays out), RePal records a tamper-evident receipt anyone can
 * check at /verify/:id. DETERMINISTIC signing (lib/receipts); the only side
 * effect is the DB write. OWNER: Aakash.
 */
export async function issueReceipt(input: ReceiptInput): Promise<SignedReceipt & { id: string }> {
  const signed = signReceipt(input);
  const row = await prisma.receipt.create({
    data: {
      userId: input.userId,
      runId: input.runId,
      item: input.item,
      merchant: input.merchant,
      category: input.category,
      priceUsd: input.priceUsd,
      savedUsd: input.savedUsd,
      cashUsd: input.cashUsd,
      paypalOrderId: input.paypalOrderId,
      paypalCaptureId: input.paypalCaptureId,
      payoutBatchId: input.payoutBatchId ?? null,
      fxInrPerUsd: input.fxInrPerUsd ?? null,
      sha256: signed.sha256,
      signature: signed.signature,
    },
  });
  return { ...signed, id: row.id };
}
