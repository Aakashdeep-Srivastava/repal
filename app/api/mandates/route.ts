import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signMandate } from "@/lib/policy/mandate";

/**
 * POST /api/mandates — create a Vault-backed mandate (cap, budget, allow-list,
 * approval threshold). DELETE ?id= to revoke.
 *
 * Creates the mandate row and signs it; the Vault setup→payment token still
 * gets wired in (lib/paypal/vault.ts = Aakash). Mandate signing (lib/policy/
 * mandate) is done. OWNER: Rachandeep Kaur.
 */
const Body = z.object({
  userId: z.string().default("demo-user"),
  capUsd: z.number().positive(),
  budgetUsd: z.number().positive(),
  approvalThresholdUsd: z.number().positive(),
  allowCategories: z.array(z.string()).default([]),
  allowMerchants: z.array(z.string()).default([]),
  expiresAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
