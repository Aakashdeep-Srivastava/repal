import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/offers?q= — Channel3 proxy (cached).
 *
 * Returns cached offers from the DB for now; wire the live Channel3 call
 * (lib/channel3.ts, AI agents layer) and cache results here.
 * OWNER: Rachandeep Kaur (discovery adapter: AI agents layer).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const offers = await prisma.offer.findMany({
    where: q ? { query: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { priceUsd: "asc" },
    take: 20,
  });
  // TODO: on cache miss, call lib/channel3.find_offers(q), persist, return.
  return NextResponse.json({ q, cached: offers.length, offers });
}
