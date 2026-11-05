/**
 * Category taxonomy — a small fixed child → parent map so that "headphones"
 * matches a mandate or reward that allows "audio" or "electronics".
 *
 * A category MATCHES an allow-list if it, or any ancestor, is in the list.
 * Unknown categories match only themselves. "*" in a list matches everything.
 *
 * DETERMINISTIC. Extend the map as new demo categories appear.
 * OWNER: Rachandeep Kaur.
 */

const PARENT: Record<string, string> = {
  // electronics
  headphones: "audio",
  headphone: "audio",
  earbuds: "audio",
  earphones: "audio",
  speakers: "audio",
  "audio accessories": "audio",
  audio: "electronics",
  tv: "electronics",
  tvs: "electronics",
  laptops: "electronics",
  laptop: "electronics",
  phones: "electronics",
  smartphones: "electronics",
  cameras: "electronics",
  gaming: "electronics",
  // dining
  restaurants: "dining",
  restaurant: "dining",
  food: "dining",
  "food & drinks": "dining",
  coffee: "dining",
  // travel
  flights: "travel",
  flight: "travel",
  airfare: "travel",
  hotels: "travel",
  hotel: "travel",
  // home
  "home goods": "home",
  furniture: "home",
  mattresses: "home",
};

export function normalizeCategory(c: string): string {
  return c.trim().toLowerCase().replace(/\s+/g, " ");
}

/** [category, parent, grandparent, …] — normalized, cycle-safe. */
export function categoryLineage(category: string): string[] {
  const out: string[] = [];
  let cur: string | undefined = normalizeCategory(category);
  while (cur && !out.includes(cur)) {
    out.push(cur);
    cur = PARENT[cur];
  }
  return out;
}

/** True iff `category` or any of its ancestors is in `list` (or list has "*"). */
export function categoryMatches(category: string, list: readonly string[]): boolean {
  const allowed = new Set(list.map(normalizeCategory));
  if (allowed.has("*")) return true;
  return categoryLineage(category).some((c) => allowed.has(c));
}
