import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signMandate } from "@/lib/policy/mandate";
import { MandateInputSchema } from "@/lib/schemas";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/mandates — create a Vault-backed mandate (cap, budget, allow-list,
 * approval threshold). DELETE ?id= to revoke.
 *
 * Creates the mandate row and signs it; the Vault setup→payment token still
 * gets wired in (lib/paypal/vault.ts = Aakash). Mandate signing (lib/policy/
 * mandate) is done. OWNER: Rachandeep Kaur.
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "mandates"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = MandateInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
  const d = parsed.data;
  // TODO(aakash): Vault setup→payment token → paypalVaultTokenId.
  // Create the row (to mint its id) and sign it in one transaction, so a signing
  // failure never leaves an unsigned mandate persisted. The signature binds the
  // authority fields + userId (lib/policy/mandate).
  const mandate = await prisma.$transaction(async (tx) => {
    const row = await tx.mandate.create({
      data: {
        userId: d.userId,
        capUsd: d.capUsd,
        budgetUsd: d.budgetUsd,
        approvalThresholdUsd: d.approvalThresholdUsd,
        allowCategories: d.allowCategories,
        allowMerchants: d.allowMerchants,
        expiresAt: new Date(d.expiresAt),
        signatureHash: "",
        status: "active",
      },
    });
    const signatureHash = signMandate(
      {
        id: row.id,
        capUsd: row.capUsd,
        budgetUsd: row.budgetUsd,
        approvalThresholdUsd: row.approvalThresholdUsd,
        allowCategories: row.allowCategories,
        allowMerchants: row.allowMerchants,
        expiresAt: row.expiresAt.toISOString(),
        paypalVaultTokenId: row.paypalVaultTokenId ?? undefined,
      },
      row.userId,
    );
    return tx.mandate.update({ where: { id: row.id }, data: { signatureHash } });
  });
  return NextResponse.json(mandate, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.mandate.update({ where: { id }, data: { status: "revoked" } });
  return NextResponse.json({ id, status: "revoked" });
}
