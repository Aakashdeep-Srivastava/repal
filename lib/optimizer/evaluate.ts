import type { Offer, Reward, RewardRule, RejectedReward } from "@/lib/types";

/**
 * evaluateReward — can this reward apply to this offer?
 *
 * Returns the applicable discount (usd) or a rejection with the quoted clause.
 * DETERMINISTIC. OWNER: Rachandeep Kaur.
 *
 * Order of checks (first failure wins the rejection):
 *   1. expiry (status === "expired" OR expiresAt in the past)
 *   2. merchant_allow / merchant_deny (offer.retailer vs the rule's list)
 *   3. min_spend_usd (offer.priceUsd floor)
 * then the discount is computed from the amount rules (percent_off /
 * flat_off_usd), or — for a giftcard/points/cashback with no amount rule —
 * from the reward's face value, and finally capped by max_discount_usd,
 * reward.valueUsd and offer.priceUsd.
 *
 * NOTE on category_allow/category_deny: an Offer carries no category field,
 * so those predicates cannot be decided here — they are enforced upstream
 * (intent/mandate) and intentionally ignored by evaluateReward.
 */

const AMOUNT_TYPES = new Set(["giftcard", "points", "cashback"]);

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function findRule(reward: Reward, predicate: string): RewardRule | undefined {
  return reward.rules.find((r) => r.predicate === predicate);
}

function asNumber(value: RewardRule["value"]): number {
  return typeof value === "number" ? value : Number(value);
}

/** Normalize a rule value into a lowercased string list (merchant lists). */
function asList(value: RewardRule["value"]): string[] {
  const arr = Array.isArray(value) ? value : [String(value)];
  return arr.map((s) => String(s).trim().toLowerCase());
}

export function evaluateReward(
  reward: Reward,
  offer: Offer,
): { appliedUsd: number } | RejectedReward {
  const reject = (reason: string, quotedClause?: string): RejectedReward =>
    quotedClause === undefined
      ? { rewardId: reward.id, reason }
      : { rewardId: reward.id, reason, quotedClause };

  // 1. Expiry.
  const expiresRule = findRule(reward, "expires_on");
  const expired =
    reward.status === "expired" ||
    (Number.isFinite(Date.parse(reward.expiresAt)) &&
      Date.parse(reward.expiresAt) < Date.now());
  if (expired) {
    return reject("reward expired", expiresRule?.quotedClause);
  }

  // 2. Merchant allow / deny.
  const retailer = offer.retailer.trim().toLowerCase();
  const allowRule = findRule(reward, "merchant_allow");
  if (allowRule && !asList(allowRule.value).includes(retailer)) {
    return reject(
      `reward not valid at ${offer.retailer}`,
      allowRule.quotedClause,
    );
  }
  const denyRule = findRule(reward, "merchant_deny");
  if (denyRule && asList(denyRule.value).includes(retailer)) {
    return reject(`reward excluded at ${offer.retailer}`, denyRule.quotedClause);
  }

  // 3. Minimum spend.
  const minSpendRule = findRule(reward, "min_spend_usd");
  if (minSpendRule) {
    const min = asNumber(minSpendRule.value);
    if (offer.priceUsd < min) {
      return reject(
        `minimum spend $${min} not met`,
        minSpendRule.quotedClause,
      );
    }
  }

  // 4. Discount from amount rules.
  const percentRule = findRule(reward, "percent_off");
  const flatRule = findRule(reward, "flat_off_usd");
  let discount = 0;
  let hasAmountRule = false;
  if (percentRule) {
    discount += offer.priceUsd * (asNumber(percentRule.value) / 100);
    hasAmountRule = true;
  }
  if (flatRule) {
    discount += asNumber(flatRule.value);
    hasAmountRule = true;
  }
  // Giftcard / points / cashback with no explicit amount rule: use face value.
  if (!hasAmountRule && AMOUNT_TYPES.has(reward.type)) {
    discount = Math.min(reward.valueUsd, offer.priceUsd);
    hasAmountRule = true;
  }
  if (!hasAmountRule) {
    return reject("no applicable discount");
  }

  // 5. Caps: max_discount_usd, reward.valueUsd (a $50 card ≤ $50), priceUsd.
  const maxRule = findRule(reward, "max_discount_usd");
  if (maxRule) discount = Math.min(discount, asNumber(maxRule.value));
  if (reward.valueUsd > 0) discount = Math.min(discount, reward.valueUsd);
  discount = Math.min(discount, offer.priceUsd);

  discount = round2(discount);
  if (discount <= 0) {
    return reject("no applicable discount");
  }

  return { appliedUsd: discount };
}
