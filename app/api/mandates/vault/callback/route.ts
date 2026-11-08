import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signMandate } from "@/lib/policy/mandate";
import { createPaymentToken } from "@/lib/paypal/vault";

/**
 * GET /api/mandates/vault/callback?mandate=<id> — buyer returns here after
 * approving the Vault setup token. We exchange the approved setup token for a
 * durable payment (vault) token, store it on the mandate as `paypalVaultTokenId`,
 * flip the mandate to `active`, and RE-SIGN it so the signature now binds the
 * vault token. Then redirect the buyer back to /mandate.
 *
 * The vault token id IS the agent's scoped spend authority — createOrder({vaultId})
 * can then charge it with no further buyer redirect.
 */
function publicBase(req: Request): string {
  const r = process.env.PAYPAL_OIDC_REDIRECT;
  return r ? new URL(r).origin : new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = publicBase(req);
  const mandateId = url.searchParams.get("mandate");
  if (!mandateId) {
    return NextResponse.redirect(new URL("/mandate?error=missing_mandate", base));
  }

  const row = await prisma.mandate.findUnique({ where: { id: mandateId } });
  if (!row) {
    return NextResponse.redirect(new URL("/mandate?error=unknown_mandate", base));
  }

  // PayPal appends approval_token_id on return; fall back to the one we stored.
  const setupTokenId = row.vaultSetupTokenId ?? url.searchParams.get("approval_token_id");

  const fields = {
    id: row.id,
    capUsd: row.capUsd,
    budgetUsd: row.budgetUsd,
    approvalThresholdUsd: row.approvalThresholdUsd,
    allowCategories: row.allowCategories,
    allowMerchants: row.allowMerchants,
    expiresAt: row.expiresAt.toISOString(),
  };

  try {
    if (!setupTokenId) throw new Error("no setup token to exchange");
    const payment = await createPaymentToken(setupTokenId);
    const signatureHash = signMandate(
      { ...fields, paypalVaultTokenId: payment.id },
      row.userId,
    );
    await prisma.mandate.update({
      where: { id: row.id },
      data: { paypalVaultTokenId: payment.id, status: "active", signatureHash },
    });
    return NextResponse.redirect(new URL("/mandate?granted=1", base));
  } catch {
    // Exchange failed — still activate a signed policy-only mandate so the user
    // isn't left with a dangling pending authority. (Vault token can be re-granted.)
    const signatureHash = signMandate({ ...fields, paypalVaultTokenId: undefined }, row.userId);
    await prisma.mandate.update({
      where: { id: row.id },
      data: { status: "active", signatureHash },
    });
    return NextResponse.redirect(new URL("/mandate?granted=1&vault=failed", base));
  }
}
