import type { Offer, Reward, RewardRule, RejectedReward } from "@/lib/types";
import { categoryMatches } from "@/lib/tnc/categories";
import { merchantMatches } from "@/lib/tnc/merchants";
import { toCents, fromCents, fmtUsd } from "@/lib/optimizer/money";

/**
 * evaluateReward — can this reward apply to this offer?
 *
 * Returns the applicable discount (usd) or a rejection with the quoted clause.
 * DETERMINISTIC. OWNER: Rachandeep Kaur.
 *
 * Checks, in order (first failure wins, so the reason shown is the most basic):
 *  1. status "expired"/"used", Reward.expiresAt or an `expires_on` rule passed → Expired
 *  2. parseConfidence below MIN_PARSE_CONFIDENCE → not auto-applied (needs review)
 *  3. merchant_allow / merchant_deny vs offer.retailer → Merchant mismatch
 *  4. category_allow / category_deny vs the purchase category (parent map) → Category mismatch
 *  5. min_spend_usd vs the offer's sticker price → Minimum spend not met
 *  6. discount = flat_off_usd + percent_off% of price (floored to the cent);
 *     if neither rule exists, Reward.valueUsd (e.g. a gift card's balance);
 *     capped by max_discount_usd and by the price itself → zero = No value
 *  7. discount < LOW_VALUE_FRACTION of price → Low value for this purchase
 */

/** Rewards parsed with lower confidence are shown but never auto-applied. */
export const MIN_PARSE_CONFIDENCE = 0.8;
/** Rewards worth less than this fraction of the price are rejected as low value. */
export const LOW_VALUE_FRACTION = 0.02;

export interface EvalContext {
  /** The purchase category (from the intent) — Offers carry no category. */
  category: string;
  /** Clock for expiry — injectable for determinism. */
  now: Date;
}

export type EvalResult = { appliedUsd: number } | RejectedReward;

export function isRejected(r: EvalResult): r is RejectedReward {
  return "reason" in r;
}

const rulesOf = (reward: Reward, predicate: string): RewardRule[] =>
  reward.rules.filter((r) => r.predicate === predicate);

const asList = (v: RewardRule["value"]): string[] =>
  Array.isArray(v) ? v : typeof v === "string" ? [v] : [String(v)];

const asNumber = (v: RewardRule["value"]): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** End of the given YYYY-MM-DD day in UTC, or null if unparseable. */
function endOfDayUtc(iso: string): number | null {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T23:59:59.999Z` : iso);
  return Number.isNaN(t) ? null : t;
}

export function evaluateReward(reward: Reward, offer: Offer, ctx: EvalContext): EvalResult {
  const reject = (reason: string, quotedClause?: string): RejectedReward =>
    quotedClause ? { rewardId: reward.id, reason, quotedClause } : { rewardId: reward.id, reason };
  const now = ctx.now.getTime();

  // 1. Expiry / status
  if (reward.status === "expired" || reward.status === "used") {
    return reject(reward.status === "used" ? "Already used" : "Expired");
  }
  const walletExpiry = Date.parse(reward.expiresAt);
  if (!Number.isNaN(walletExpiry) && now >= walletExpiry) {
    return reject(`Expired on ${reward.expiresAt.slice(0, 10)}`);
  }
  for (const rule of rulesOf(reward, "expires_on")) {
    const end = typeof rule.value === "string" ? endOfDayUtc(rule.value) : null;
    if (end !== null && now > end) {
      return reject(`Expired on ${String(rule.value)}`, rule.quotedClause);
    }
  }

  // 2. Parse confidence
  if (reward.parseConfidence < MIN_PARSE_CONFIDENCE) {
    return reject(
      `Terms not confidently parsed (confidence ${reward.parseConfidence.toFixed(2)} < ` +
        `${MIN_PARSE_CONFIDENCE}) — shown for review, not auto-applied`,
    );
  }

  // 3. Merchant
  for (const rule of rulesOf(reward, "merchant_allow")) {
    if (!merchantMatches(offer.retailer, asList(rule.value))) {
      return reject(
        `Merchant mismatch: only valid at ${asList(rule.value).join(", ")}, not ${offer.retailer}`,
        rule.quotedClause,
      );
    }
  }
  for (const rule of rulesOf(reward, "merchant_deny")) {
    if (merchantMatches(offer.retailer, asList(rule.value))) {
      return reject(`Merchant excluded: not valid at ${offer.retailer}`, rule.quotedClause);
    }
  }

  // 4. Category
  for (const rule of rulesOf(reward, "category_allow")) {
    if (!categoryMatches(ctx.category, asList(rule.value))) {
      return reject(
        `Category mismatch: valid for ${asList(rule.value).join(", ")}, not ${ctx.category}`,
        rule.quotedClause,
      );
    }
  }
  for (const rule of rulesOf(reward, "category_deny")) {
    if (categoryMatches(ctx.category, asList(rule.value))) {
      return reject(`Category excluded: not valid for ${ctx.category}`, rule.quotedClause);
    }
  }

  // 5. Minimum spend (on the sticker price)
  const price = toCents(offer.priceUsd);
  for (const rule of rulesOf(reward, "min_spend_usd")) {
    const min = asNumber(rule.value);
    if (min !== null && price < toCents(min)) {
      return reject(
        `Minimum spend not met: requires ${fmtUsd(min)}, price is ${fmtUsd(offer.priceUsd)}`,
        rule.quotedClause,
      );
    }
  }

  // 6. Discount amount
  const flats = rulesOf(reward, "flat_off_usd").map((r) => asNumber(r.value)).filter((n): n is number => n !== null);
  const pcts = rulesOf(reward, "percent_off").map((r) => asNumber(r.value)).filter((n): n is number => n !== null);
  let discount: number;
  if (flats.length === 0 && pcts.length === 0) {
    discount = toCents(reward.valueUsd);
  } else {
    discount =
      flats.reduce((s, f) => s + toCents(f), 0) +
      pcts.reduce((s, p) => s + Math.floor((price * p) / 100), 0);
  }
  for (const rule of rulesOf(reward, "max_discount_usd")) {
    const cap = asNumber(rule.value);
    if (cap !== null) discount = Math.min(discount, toCents(cap));
  }
  discount = Math.max(0, Math.min(discount, price));
  if (discount === 0) return reject("No redeemable value for this purchase");

  // 7. Low value
  if (discount < price * LOW_VALUE_FRACTION) {
    return reject(
      `Low value for this purchase: ${fmtUsd(fromCents(discount))} is under ` +
        `${LOW_VALUE_FRACTION * 100}% of ${fmtUsd(offer.priceUsd)}`,
    );
  }

  return { appliedUsd: fromCents(discount) };
}

/** The reward's not_combinable_group, if any (first rule wins). */
export function stackingGroup(reward: Reward): { group: string; quotedClause: string } | null {
  const rule = rulesOf(reward, "not_combinable_group")[0];
  return rule ? { group: String(rule.value).trim().toLowerCase(), quotedClause: rule.quotedClause } : null;
}
