import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { CATALOG, catalogRules } from "@/lib/merchants/catalog";

/**
 * GET /api/wallet — the auto-imported reward wallet for the current user.
 *
 * Functional DB read (proves DB→API). The wallet is scoped to the signed-in
 * user (or the public judge-demo persona when logged out). A `?userId=`
 * override is honored ONLY outside production (for E2E/test tooling); in
 * production it is ignored, so one user can never read another's wallet.
 * OWNER: Rachandeep Kaur.
 */
export async function GET(req: Request) {
  const explicit =
    process.env.NODE_ENV !== "production"
      ? new URL(req.url).searchParams.get("userId")
      : null;
  const userId = explicit ?? (await getSessionUser()).userId;
  let rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { expiresAt: "asc" },
  });

  // Lazy backfill: rewards claimed before deterministic catalog rules existed
  // were stored unparsed (parseConfidence 0, rules {}) and so never auto-applied.
  // For KNOWN catalog offers the terms are deterministic — heal them on read
  // (idempotent, once per row) so an older wallet starts stacking immediately.
  const stale = rewards.filter(
    (r) => r.offerId != null && r.parseConfidence < 1 && CATALOG.some((o) => o.id === r.offerId),
  );
  if (stale.length) {
    await Promise.all(
      stale.map((r) => {
        const offer = CATALOG.find((o) => o.id === r.offerId)!;
        return prisma.reward.update({
          where: { id: r.id },
          data: { rules: catalogRules(offer) as object[], parseConfidence: 1 },
        });
      }),
    );
    rewards = await prisma.reward.findMany({ where: { userId }, orderBy: { expiresAt: "asc" } });
  }

  return NextResponse.json({ userId, count: rewards.length, rewards });
}
