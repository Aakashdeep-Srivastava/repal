import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/wallet — the auto-imported reward wallet for the current user.
 *
 * Functional DB read (proves DB→API). User precedence: an explicit `?userId=`
 * query param (used by tests) wins, then the signed session user, then the
 * `demo-user` fallback so the unauthenticated wallet still renders.
 * OWNER: Rachandeep Kaur.
 */
export async function GET(req: Request) {
  const explicit = new URL(req.url).searchParams.get("userId");
  const userId = explicit ?? (await getSessionUser()).userId ?? "demo-user";
  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json({ userId, count: rewards.length, rewards });
}
