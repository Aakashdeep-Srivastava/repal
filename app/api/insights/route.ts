import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/insights — a self-contained spend/savings dashboard built from
 * RePal's OWN signed artifacts (receipts, payouts, refunds), scoped to the
 * session user. No external reporting API — every number here is backed by a
 * verifiable receipt.
 */
export const dynamic = "force-dynamic";

const REVERSAL = new Set(["reversal", "reward-liberation"]);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "insights"), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { userId } = await getSessionUser();

  const [receipts, payouts, refunds, runs, activeMandate] = await Promise.all([
    prisma.receipt.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.payout.findMany({ where: { userId } }),
    prisma.refund.findMany({ where: { userId } }),
    prisma.agentRun.count({ where: { userId } }),
    prisma.mandate.count({ where: { userId, status: "active" } }),
  ]);

  const purchases = receipts.filter((r) => !REVERSAL.has(r.category));
  const totalSpent = purchases.reduce((s, r) => s + r.cashUsd, 0);
  const totalSaved = purchases.reduce((s, r) => s + r.savedUsd, 0);
  const totalLiberated = payouts.reduce((s, p) => s + p.amountUsd, 0);
  const totalRefunded = refunds.reduce((s, r) => s + (r.amountUsd ?? 0), 0);

  // Daily spend + saved over the last 30 days (zero-filled).
  const days = 30;
  const buckets = new Map<string, { spent: number; saved: number }>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    buckets.set(dayKey(d), { spent: 0, saved: 0 });
  }
  for (const r of purchases) {
    const k = dayKey(new Date(r.createdAt));
    const b = buckets.get(k);
    if (b) {
      b.spent += r.cashUsd;
      b.saved += r.savedUsd;
    }
  }
  const series = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));

  // Up to 100 rows so the grid's sort/filter/search/pagination are meaningful
  // (receipts are already ordered newest-first above).
  const recent = receipts.slice(0, 100).map((r) => ({
    id: r.id,
    item: r.item,
    merchant: r.merchant,
    category: r.category,
    cashUsd: r.cashUsd,
    savedUsd: r.savedUsd,
    createdAt: r.createdAt,
    verifyUrl: `/verify/${r.id}`,
  }));

  return NextResponse.json({
    kpis: {
      totalSpent,
      totalSaved,
      totalLiberated,
      totalRefunded,
      purchases: purchases.length,
      payouts: payouts.length,
      refunds: refunds.length,
      runs,
      activeMandate,
    },
    series,
    recent,
  });
}
