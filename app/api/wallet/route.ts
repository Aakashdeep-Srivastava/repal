import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

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
  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json({ userId, count: rewards.length, rewards });
}
