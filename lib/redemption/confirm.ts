/**
 * confirmRedemption — the single place RePal turns a merchant/affiliate confirmation
 * into a ledger fact. It calls a RedemptionAdapter and, ONLY on a genuine confirmation,
 * stamps the redemption with the confirmation source/ref/time. That stamp is the gate
 * `markPayable` (lib/ledger/settle.ts) checks before advancing any commission or cashback
 * to `payable` — so internal eligibility never becomes a payable obligation on its own.
 *
 * Deterministic + atomic. The adapter decides; this function records. No money math here.
 * OWNER: commercial ledger.
 */
import type { PrismaClient } from "@prisma/client";
import type { RedemptionAdapter } from "./types";

export class RedemptionConfirmError extends Error {
  constructor(
    public code: "unknown_redemption",
    message: string,
  ) {
    super(message);
    this.name = "RedemptionConfirmError";
  }
}

export interface ConfirmRedemptionResult {
  redemptionId: string;
  confirmed: boolean;
  /** True when the redemption was already confirmed (idempotent no-op). */
  alreadyConfirmed: boolean;
  source: string;
  confirmationRef: string | null;
  simulated: boolean;
  reason?: string;
}

export async function confirmRedemption(
  prisma: PrismaClient,
  redemptionId: string,
  adapter: RedemptionAdapter,
): Promise<ConfirmRedemptionResult> {
  const redemption = await prisma.redemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) {
    throw new RedemptionConfirmError("unknown_redemption", `confirmRedemption: unknown redemption ${redemptionId}`);
  }

  // A reversed redemption is terminal — never confirm it into a payable.
  if (redemption.status === "reversed") {
    return {
      redemptionId,
      confirmed: false,
      alreadyConfirmed: false,
      source: adapter.source,
      confirmationRef: null,
      simulated: adapter.simulated,
      reason: "reversed",
    };
  }

  // Idempotent: a second confirmation is a no-op, reporting the stored facts.
  if (redemption.confirmedAt) {
    return {
      redemptionId,
      confirmed: true,
      alreadyConfirmed: true,
      source: redemption.confirmationSource ?? adapter.source,
      confirmationRef: redemption.confirmationRef,
      simulated: adapter.simulated,
    };
  }

  const verdict = await adapter.confirm({
    redemptionId,
    code: redemption.code,
    offerId: redemption.offerId,
    merchantId: redemption.merchantId,
    netPaidCents: redemption.netPaidCents,
  });

  if (!verdict.confirmed) {
    // Not confirmed → commissions stay `pending`; nothing is stamped.
    return {
      redemptionId,
      confirmed: false,
      alreadyConfirmed: false,
      source: adapter.source,
      confirmationRef: null,
      simulated: verdict.simulated,
      reason: verdict.reason ?? "not_confirmed",
    };
  }

  await prisma.redemption.update({
    where: { id: redemptionId },
    data: {
      confirmedAt: new Date(),
      confirmationSource: adapter.source,
      confirmationRef: verdict.confirmationRef ?? null,
    },
  });

  return {
    redemptionId,
    confirmed: true,
    alreadyConfirmed: false,
    source: adapter.source,
    confirmationRef: verdict.confirmationRef ?? null,
    simulated: verdict.simulated,
  };
}
