import "server-only";
import { Channel3, Channel3Api, Channel3Error } from "@channel3/sdk";
import type { Offer } from "@/lib/types";
import type { Product, MerchantOffer } from "@/lib/shop/types";

/**
 * Channel3 discovery adapter (Agent A3 — Discovery).
 *
 * Wraps the official `@channel3/sdk` with a server-side API key to retrieve real
 * merchant SKUs before the deterministic optimizer evaluates rewards. All
 * mapping normalizes Channel3's `Product`/`ProductOffer` into our `Product`
 * (rich: images, every merchant offer, availability, brand) and the minimal
 * `Offer` the optimizer consumes — nothing here recomputes money; prices pass
 * straight through from the merchant offers. See docs/TECH_PRD.md §5.
 *
 * The key NEVER leaves the server (this module is server-only). Locale and
 * live/demo mode are env-driven and independent of the PayPal payment mode.
 *
 * OWNER: AI agents layer (discovery). Used by /api/products, /api/products/[id],
 * /api/offers, and /api/health/channel3.
 */

const COUNTRY = (process.env.CHANNEL3_COUNTRY?.trim() || "US").toUpperCase() as Channel3Api.CountryCode;
const CURRENCY = (process.env.CHANNEL3_CURRENCY?.trim() || "USD").toUpperCase() as Channel3Api.CurrencyCode;

function apiKey(): string | null {
  const k = process.env.CHANNEL3_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

/** True iff a Channel3 API key is configured. */
export function isChannel3Configured(): boolean {
  return apiKey() !== null;
}

/**
 * Discovery mode, independent of the PayPal payment mode. `CHANNEL3_MODE`:
 *   - "live"  → always use Channel3 (errors if no key)
 *   - "demo"  → always use the labelled sandbox catalog
 *   - "auto"  → live when a key is present, else demo (default)
 */
export function channel3DiscoveryMode(): "live" | "demo" {
  const mode = (process.env.CHANNEL3_MODE?.trim() || "auto").toLowerCase();
  if (mode === "demo") return "demo";
  if (mode === "live") return "live";
  return isChannel3Configured() ? "live" : "demo";
}

export const channel3Locale = { country: COUNTRY, currency: CURRENCY } as const;

// ── Typed failures ──────────────────────────────────────────────────────────

export type Channel3FailureKind =
  | "config" // no key / misconfigured
  | "unauthorized" // 401/403 — bad/expired key
  | "rate_limited" // 429
  | "bad_request" // 400/422
  | "upstream"; // 5xx / network / unknown

/** A normalized Channel3 failure the API routes can map to an HTTP status. */
export class Channel3Failure extends Error {
  constructor(
    readonly kind: Channel3FailureKind,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "Channel3Failure";
  }
}

function toFailure(e: unknown): Channel3Failure {
  if (e instanceof Channel3Failure) return e;
  if (e instanceof Channel3Error) {
    const s = e.statusCode ?? 0;
    const kind: Channel3FailureKind =
      s === 401 || s === 403
        ? "unauthorized"
        : s === 429
          ? "rate_limited"
          : s === 400 || s === 422
            ? "bad_request"
            : "upstream";
    return new Channel3Failure(kind, s, e.message || `Channel3 error (${s})`);
  }
  return new Channel3Failure(
    "upstream",
    0,
    e instanceof Error ? e.message : "Channel3 request failed",
  );
}

// ── Client singleton ─────────────────────────────────────────────────────────

let _client: Channel3 | null = null;
function client(): Channel3 {
  const key = apiKey();
  if (!key) {
    throw new Channel3Failure(
      "config",
      0,
      "Missing CHANNEL3_API_KEY. Add it to .env.local (discovery runs in demo mode until then).",
    );
  }
  if (!_client) _client = new Channel3({ apiKey: key });
  return _client;
}

// ── Mapping (Channel3 → our Product / Offer) ─────────────────────────────────

/** Best (cheapest) offer in the requested currency, or null when none is usable. */
function bestOffer(
  offers: Channel3Api.ProductOffer[],
): Channel3Api.ProductOffer | null {
  const usable = offers.filter(
    (o) =>
      typeof o.price?.price === "number" &&
      (o.price.currency ?? CURRENCY).toUpperCase() === CURRENCY,
  );
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => (a.price.price <= b.price.price ? a : b));
}

/** Prefer the background-removed CDN shot (best for grids), then the main image. */
function mainImage(p: Channel3Api.Product): string | undefined {
  const imgs = p.images ?? [];
  if (imgs.length === 0) return undefined;
  const main = imgs.find((i) => i.is_main_image) ?? imgs[0];
  return main?.cleaned_url ?? main?.url ?? undefined;
}

function toMerchantOffers(offers: Channel3Api.ProductOffer[]): MerchantOffer[] {
  return offers
    .filter((o) => typeof o.price?.price === "number")
    .map((o) => ({
      domain: o.domain,
      priceUsd: o.price.price,
      compareAtUsd: o.price.compare_at_price ?? undefined,
      currency: (o.price.currency ?? CURRENCY).toUpperCase(),
      availability: o.availability ?? "InStock",
      condition: o.condition ?? null,
      buyUrl: o.url,
      maxCommissionRate: o.max_commission_rate,
    }))
    .sort((a, b) => a.priceUsd - b.priceUsd);
}

/**
 * Map a Channel3 `Product` to our `Product`. Returns null when the product has
 * no usable in-locale offer (not shoppable here) — the optimizer needs a price.
 * `queryFallback` seeds `category` when the product carries no structured one.
 */
function mapProduct(p: Channel3Api.Product, queryFallback: string): Product | null {
  const offers = p.offers ?? [];
  const best = bestOffer(offers);
  if (!best) return null;
  const category =
    p.category?.slug?.trim() ||
    p.category?.title?.trim() ||
    queryFallback.trim() ||
    "product";
  return {
    id: p.id,
    title: p.title,
    priceUsd: best.price.price,
    retailer: best.domain,
    buyUrl: best.url,
    category,
    description: p.description ?? undefined,
    availability: best.availability ?? undefined,
    imageUrl: mainImage(p),
    brand: p.brands?.[0]?.name,
    currency: (best.price.currency ?? CURRENCY).toUpperCase(),
    compareAtUsd: best.price.compare_at_price ?? undefined,
    offers: toMerchantOffers(offers),
    source: "channel3",
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface SearchOptions {
  maxPriceUsd?: number;
  limit?: number;
}

/** Live product search → rich Products (images + every merchant offer). */
export async function searchChannel3Products(
  query: string,
  opts: SearchOptions = {},
): Promise<Product[]> {
  const c = client();
  const req: Channel3Api.SearchRequest = {
    query: query.trim() || null,
    limit: Math.min(Math.max(opts.limit ?? 12, 1), 30),
    config: { country: COUNTRY, currency: CURRENCY },
  };
  if (opts.maxPriceUsd !== undefined && opts.maxPriceUsd > 0) {
    req.filters = { price: { max_price: opts.maxPriceUsd } };
  }
  try {
    const page = await c.products.search(req);
    return (page.data ?? [])
      .map((p) => mapProduct(p, query))
      .filter((x): x is Product => x !== null);
  } catch (e) {
    throw toFailure(e);
  }
}

/** Full product details by Channel3 id (free; hydrated variants). */
export async function getChannel3Product(id: string): Promise<Product | null> {
  const c = client();
  try {
    const p = await c.products.retrieve({
      product_id: id,
      country: COUNTRY,
      currency: CURRENCY,
    });
    return mapProduct(p, "");
  } catch (e) {
    const f = toFailure(e);
    // A product with no offer in this locale is a legitimate "not found here".
    if (f.status === 404) return null;
    throw f;
  }
}

/** Resolve a merchant URL the user pasted to the canonical product. */
export async function lookupChannel3(url: string): Promise<Product | null> {
  const c = client();
  try {
    const { product } = await c.products.lookup({ url });
    return product ? mapProduct(product, "") : null;
  } catch (e) {
    const f = toFailure(e);
    if (f.status === 404 || f.status === 422) return null;
    throw f;
  }
}

/**
 * Backward-compatible minimal-Offer search (cheapest in-locale offer per
 * product) for the optimizer's cached /api/offers proxy. Nothing here computes
 * money; prices pass through from the merchant offer.
 */
export async function findOffers(
  query: string,
  opts: SearchOptions = {},
): Promise<Offer[]> {
  const products = await searchChannel3Products(query, opts);
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    priceUsd: p.priceUsd,
    retailer: p.retailer,
    buyUrl: p.buyUrl,
  }));
}

export interface Channel3Health {
  configured: boolean;
  mode: "live" | "demo";
  reachable: boolean;
  country: string;
  currency: string;
  sdkVersion?: string;
  latencyMs?: number;
  sampleCount?: number;
  error?: { kind: Channel3FailureKind; status: number };
}

/**
 * Server-side integration health check — reports configuration + provider
 * connectivity WITHOUT exposing the key. Runs a tiny live search when a key is
 * present; reports the failure kind (unauthorized / rate_limited / …) otherwise.
 */
export async function channel3Health(): Promise<Channel3Health> {
  const configured = isChannel3Configured();
  const mode = channel3DiscoveryMode();
  const base: Channel3Health = {
    configured,
    mode,
    reachable: false,
    country: COUNTRY,
    currency: CURRENCY,
  };
  if (!configured) return base;
  const started = Date.now();
  try {
    const c = client();
    const page = await c.products.search({
      query: "test",
      limit: 1,
      config: { country: COUNTRY, currency: CURRENCY },
    });
    return {
      ...base,
      reachable: true,
      latencyMs: Date.now() - started,
      sampleCount: (page.data ?? []).length,
    };
  } catch (e) {
    const f = toFailure(e);
    return { ...base, reachable: false, error: { kind: f.kind, status: f.status } };
  }
}
