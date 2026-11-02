import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findOffers } from "@/lib/channel3";

/**
 * GET /api/offers?q=&max= — Channel3 proxy (cached).
 *
 * Serves cached offers from the DB; on a cache miss, calls Channel3, persists
 * the results, and returns them. See docs/TECH_PRD.md §5.
 * OWNER: Rachandeep Kaur (route) + AI agents layer (lib/channel3).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const max = url.searchParams.get("max");
  const maxPriceUsd = max ? Number(max) : undefined;

  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  // Cache: offers stored for this query in the last hour.
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const cached = await prisma.offer.findMany({
    where: { query: q, cachedAt: { gte: oneHourAgo } },
    orderBy: { priceUsd: "asc" },
    take: 20,
  });
  if (cached.length > 0) {
    return NextResponse.json({ q, source: "cache", offers: cached });
  }

  // Cache miss → live Channel3.
  try {
    const offers = await findOffers(q, { maxPriceUsd, limit: 10 });
    await Promise.all(
      offers.map((o) =>
        prisma.offer.upsert({
          where: { id: o.id },
          update: { query: q, title: o.title, priceUsd: o.priceUsd, retailer: o.retailer, buyUrl: o.buyUrl, cachedAt: new Date() },
          create: { id: o.id, query: q, title: o.title, priceUsd: o.priceUsd, retailer: o.retailer, buyUrl: o.buyUrl },
        }),
      ),
    );
    return NextResponse.json({ q, source: "channel3", count: offers.length, offers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "offers failed" },
      { status: 502 },
    );
  }
}
