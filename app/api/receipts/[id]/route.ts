import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/receipts/:id — the signed decision receipt JSON.
 * Functional DB read. The public verifier lives at /verify/:id.
 * OWNER: Rachandeep Kaur.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
