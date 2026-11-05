/**
 * Merchant matching — reward T&Cs name merchants ("Best Buy") while Channel3
 * offers carry a retailer domain ("bestbuy.com", "us.sennheiser-hearing.com").
 *
 * Both sides are reduced to a key of lowercase letters/digits:
 *   "Best Buy" → "bestbuy",  "www.bestbuy.com" → "bestbuy",
 *   "us.sennheiser-hearing.com" → "sennheiserhearing".
 * Two merchants match if their keys are equal, or one key starts with the
 * other and the shorter key is at least 4 characters ("sennheiser" ↔
 * "sennheiserhearing"). "*" in a list matches everything.
 *
 * DETERMINISTIC. OWNER: Rachandeep Kaur.
 */

const MIN_PREFIX = 4;

function looksLikeDomain(s: string): boolean {
  return !/\s/.test(s) && /\.[a-z]{2,}$/i.test(s);
}

export function merchantKey(merchant: string): string {
  let s = merchant.trim().toLowerCase();
  if (looksLikeDomain(s.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))) {
    s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const labels = s.split(".");
    // Drop the TLD; keep the label just before it ("us.sennheiser-hearing.com" → "sennheiser-hearing").
    s = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  }
  return s.replace(/[^a-z0-9]/g, "");
}

export function merchantMatches(merchant: string, list: readonly string[]): boolean {
  const a = merchantKey(merchant);
  if (!a) return false;
  return list.some((m) => {
    if (m.trim() === "*") return true;
    const b = merchantKey(m);
    if (!b) return false;
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= MIN_PREFIX && long.startsWith(short);
  });
}
