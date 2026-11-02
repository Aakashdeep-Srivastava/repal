import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/wallet — the auto-imported reward wallet for the current user.
 *
 * Functional DB read (proves DB→API). Swap the demo user for the session user
 * once auth lands. OWNER: Rachandeep Kaur.
 */
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") ?? "demo-user";
  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json({ userId, count: rewards.length, rewards });
}
