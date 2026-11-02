import type { Offer } from "@/lib/types";

/**
 * Channel3 discovery adapter (A3).
 *
 * POST https://api.trychannel3.com/v1/search with an `x-api-key` header →
 * ranked real products across retailers. Mapped to our normalized Offer type
 * so the optimizer only ever sees normalized rows. See docs/TECH_PRD.md §5.
 *
 * OWNER: AI agents layer (discovery). Used by GET /api/offers.
 */

const CHANNEL3_BASE = "https://api.trychannel3.com";

interface Channel3Price {
  price?: number;
  compare_at_price?: number | null;
  currency?: string;
}
interface Channel3Offer {
  url?: string; // the buy link
  domain?: string; // retailer domain, e.g. "lunchboxaudio.com"
  price?: Channel3Price;
  availability?: string;
}
interface Channel3Product {
  id: string;
  title: string;
  offers?: Channel3Offer[];
}
interface Channel3SearchResponse {
  products?: Channel3Product[];
  next_page_token?: string;
}

export interface FindOffersOptions {
  maxPriceUsd?: number;
  limit?: number;
}

/** Search Channel3 and return normalized Offers (cheapest USD offer per product). */
export async function findOffers(
  query: string,
  opts: FindOffersOptions = {},
): Promise<Offer[]> {
  const apiKey = process.env.CHANNEL3_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing CHANNEL3_API_KEY. Add it to .env.local (see docs/PAYPAL_SETUP.md / README).",
    );
  }

  const body: Record<string, unknown> = { query, limit: opts.limit ?? 10 };
  if (opts.maxPriceUsd !== undefined) {
    body.filters = { price: { max_price: opts.maxPriceUsd } };
  }

  const res = await fetch(`${CHANNEL3_BASE}/v1/search`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Channel3 search failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as Channel3SearchResponse;
  return (data.products ?? [])
    .map(toOffer)
    .filter((o): o is Offer => o !== null);
}

/** Pick the cheapest in-currency USD offer and normalize to our Offer shape. */
function toOffer(p: Channel3Product): Offer | null {
  const usdOffers = (p.offers ?? []).filter(
    (o) =>
      typeof o.price?.price === "number" &&
      (o.price?.currency ?? "USD").toUpperCase() === "USD",
  );
  if (usdOffers.length === 0) return null;
  const best = usdOffers.reduce((a, b) =>
    (a.price!.price! <= b.price!.price! ? a : b),
  );
  return {
    id: p.id,
    title: p.title,
    priceUsd: best.price!.price!,
    retailer: best.domain ?? "unknown",
    buyUrl: best.url ?? "",
  };
}
