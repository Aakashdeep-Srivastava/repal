/**
 * Curated shop categories — the Amazon-style department nav on /shop.
 *
 * Each category maps a human label to a Channel3 search `query`. We deliberately
 * drive categories through the proven free-text search path (every `query` here
 * returns a full, well-tagged result set) rather than Channel3 category slugs:
 * it's one code path, no slug-discovery round-trip, and no risk of an unknown
 * slug being silently dropped. Clicking a chip just navigates to /shop?q=<query>.
 *
 * Keep this list broad and cross-department so the storefront reflects the
 * catalog's breadth. Icons are plain emoji (no asset pipeline).
 *
 * OWNER: shopping journey (discovery UX).
 */

export interface ShopCategory {
  /** Display name on the chip. */
  label: string;
  /** Channel3 search query this category resolves to. */
  query: string;
  /** Decorative emoji icon. */
  icon: string;
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  { label: "Electronics", query: "electronics", icon: "💻" },
  { label: "Headphones", query: "headphones", icon: "🎧" },
  { label: "Fashion", query: "clothing", icon: "👕" },
  { label: "Shoes", query: "shoes", icon: "👟" },
  { label: "Jewelry", query: "jewelry", icon: "💍" },
  { label: "Beauty", query: "beauty", icon: "💄" },
  { label: "Home & Kitchen", query: "home kitchen", icon: "🏠" },
  { label: "Bags", query: "handbags", icon: "👜" },
  { label: "Watches", query: "watches", icon: "⌚" },
  { label: "Sports", query: "sports", icon: "🏀" },
] as const;

/** True iff `q` matches a known category query (case-insensitive). */
export function isCategoryQuery(q: string | null | undefined): boolean {
  if (!q) return false;
  const needle = q.trim().toLowerCase();
  return SHOP_CATEGORIES.some((c) => c.query.toLowerCase() === needle);
}
