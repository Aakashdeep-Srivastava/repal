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

/**
 * Retry a Channel3 SDK call on TRANSIENT failures only (rate-limited / upstream),
 * with exponential backoff (200ms, 400ms). Config / auth / bad-request errors are
 * not retried — they won't fix themselves. The ORIGINAL error is re-thrown so the
 * caller's `toFailure()` classification is unchanged.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const kind = (e instanceof Channel3Failure ? e : toFailure(e)).kind;
      const transient = kind === "rate_limited" || kind === "upstream";
      if (i >= attempts - 1 || !transient) throw e;
      await new Promise((r) => setTimeout(r, 200 * 2 ** i));
    }
  }
}

// ── Short-lived in-memory cache (browse path) ────────────────────────────────
// The rich product search hits Channel3 live on every call; a brief TTL cache
// spares the API under repeated/identical browsing without risking stale prices.
// Keyed by query + filters + locale; 60s TTL; simple LRU eviction.
const PRODUCT_TTL_MS = 60_000;
const PRODUCT_CACHE_MAX = 200;
const productCache = new Map<string, { value: Product[]; at: number }>();

function cacheGet(key: string): Product[] | null {
  const hit = productCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PRODUCT_TTL_MS) {
    productCache.delete(key);
    return null;
  }
  productCache.delete(key); // refresh recency (move to newest)
  productCache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: Product[]): void {
  productCache.set(key, { value, at: Date.now() });
  if (productCache.size > PRODUCT_CACHE_MAX) {
    const oldest = productCache.keys().next().value;
    if (oldest !== undefined) productCache.delete(oldest);
  }
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
  return usable.reduce((a, b) => {
    // The user ALWAYS gets the cheapest price. Only when two offers tie on price
    // do we prefer the one that earns RePal more (affiliate commission) — a
    // revenue lever that never costs the shopper a cent.
    if (a.price.price !== b.price.price) return a.price.price < b.price.price ? a : b;
    return (a.max_commission_rate ?? 0) >= (b.max_commission_rate ?? 0) ? a : b;
  });
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
    // Cheapest first; ties broken by higher commission (same rule as bestOffer).
    .sort(
      (a, b) =>
        a.priceUsd - b.priceUsd ||
        (b.maxCommissionRate ?? 0) - (a.maxCommissionRate ?? 0),
    );
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

/**
 * Seed queries for the default "browse" landing (empty search box).
 *
 * Channel3 has NO "return everything" call — an empty/null `query` is a hard 422
 * ("At least one of 'query', 'image_url', 'base64_image', or 'page_token' must be
 * provided"). So a blank query means "browse": we fan out a few broad, varied
 * seed searches and interleave them into one storefront grid. Kept deliberately
 * cross-category so the landing reflects the catalog's breadth, not one aisle.
 */
const DEFAULT_BROWSE_SEEDS = [
  "best selling gifts",
  "trending fashion",
  "popular electronics",
  "home essentials",
] as const;

/**
 * Broad storefront grid for an empty query. Fans out the default seeds in
 * parallel, dedupes by product id, and round-robin interleaves them for variety.
 * Transient per-seed failures are tolerated; only a total wipeout (e.g. bad key)
 * re-throws, so genuine auth/rate errors still surface instead of a blank grid.
 */
export async function browseDefaultChannel3(
  opts: SearchOptions = {},
): Promise<Product[]> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 30);
  const cacheKey = `__browse__|${opts.maxPriceUsd ?? ""}|${COUNTRY}|${CURRENCY}|${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const per = Math.max(3, Math.ceil(limit / DEFAULT_BROWSE_SEEDS.length) + 1);
  const settled = await Promise.allSettled(
    DEFAULT_BROWSE_SEEDS.map((seed) =>
      searchChannel3Products(seed, { maxPriceUsd: opts.maxPriceUsd, limit: per }),
    ),
  );
  const batches = settled
    .filter((r): r is PromiseFulfilledResult<Product[]> => r.status === "fulfilled")
    .map((r) => r.value);
  if (batches.length === 0) {
    // Every seed failed — surface the real failure (unauthorized / rate_limited / …).
    const firstRej = settled.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    throw firstRej ? firstRej.reason : new Channel3Failure("upstream", 0, "Channel3 browse failed");
  }

  // Round-robin interleave across seeds, dedupe by id, cap at limit.
  const seen = new Set<string>();
  const merged: Product[] = [];
  for (let i = 0; merged.length < limit; i++) {
    let advanced = false;
    for (const batch of batches) {
      const p = batch[i];
      if (!p) continue;
      advanced = true;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
      if (merged.length >= limit) break;
    }
    if (!advanced) break; // all batches exhausted
  }

  cacheSet(cacheKey, merged);
  return merged;
}

/** Live product search → rich Products (images + every merchant offer). */
export async function searchChannel3Products(
  query: string,
  opts: SearchOptions = {},
): Promise<Product[]> {
  // An empty/whitespace query is a "browse" intent, not a search. Channel3 rejects
  // a null query (422), so never send one — fan out to the default seeds instead.
  if (query.trim() === "") return browseDefaultChannel3(opts);

  const cacheKey = `${query.trim()}|${opts.maxPriceUsd ?? ""}|${opts.limit ?? ""}|${COUNTRY}|${CURRENCY}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

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
    const page = await withRetry(() => c.products.search(req));
    const products = (page.data ?? [])
      .map((p) => mapProduct(p, query))
      .filter((x): x is Product => x !== null);
    cacheSet(cacheKey, products);
    return products;
  } catch (e) {
    throw toFailure(e);
  }
}

/** Full product details by Channel3 id (free; hydrated variants). */
export async function getChannel3Product(id: string): Promise<Product | null> {
  const c = client();
  try {
    const p = await withRetry(() =>
      c.products.retrieve({ product_id: id, country: COUNTRY, currency: CURRENCY }),
    );
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
