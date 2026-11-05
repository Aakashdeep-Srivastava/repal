import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * POST /api/mandates — create a Vault-backed mandate (cap, budget, allow-list,
 * approval threshold). DELETE ?id= to revoke.
 *
 * Creates the mandate row now; the Vault setup→payment token and the signature
 * get wired in (lib/paypal/vault.ts = Aakash, lib/policy/mandate signing =
 * rachan). OWNER: Rachandeep Kaur.
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
  // TODO(rachan): sign canonical mandate (lib/policy/mandate) → signatureHash.
  const mandate = await prisma.mandate.create({
    data: {
      userId: d.userId,
      capUsd: d.capUsd,
      budgetUsd: d.budgetUsd,
      approvalThresholdUsd: d.approvalThresholdUsd,
      allowCategories: d.allowCategories,
      allowMerchants: d.allowMerchants,
      expiresAt: new Date(d.expiresAt),
      signatureHash: "unsigned-todo",
      status: "active",
    },
  });
  return NextResponse.json(mandate, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.mandate.update({ where: { id }, data: { status: "revoked" } });
  return NextResponse.json({ id, status: "revoked" });
}
