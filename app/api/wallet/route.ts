import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/wallet — the auto-imported reward wallet for the current user.
 *
 * Functional DB read (proves DB→API). The wallet is always scoped to the
 * signed-in user (or the public judge-demo persona when logged out) — the
 * `?userId=` override was removed to prevent reading another user's wallet.
 * OWNER: Rachandeep Kaur.
 */
export async function GET() {
  const { userId } = await getSessionUser();
  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json({ userId, count: rewards.length, rewards });
}
