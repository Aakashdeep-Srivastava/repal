import { describe, it, expect } from "vitest";
import type {
  Offer,
  Reward,
  RewardRule,
  Mandate,
  PurchaseIntent,
  RejectedReward,
} from "@/lib/types";
import { evaluateReward } from "./evaluate";
import { bestStack } from "./stack";
import { optimize } from "./index";

// ─── Fixtures ────────────────────────────────────────────────────────
const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function offer(partial: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    title: "Sony WH-1000XM5",
    priceUsd: 200,
    retailer: "bestbuy.com",
    buyUrl: "https://bestbuy.com/sony",
    ...partial,
  };
}

function reward(partial: Partial<Reward> = {}): Reward {
  return {
    id: "rw_1",
    source: "seed",
    type: "coupon",
    valueUsd: 0,
    termsRaw: "",
    rules: [],
    status: "active",
    parseConfidence: 1,
    expiresAt: FUTURE,
    ...partial,
  };
}

function rule(
  predicate: string,
  value: RewardRule["value"],
  quotedClause = `clause:${predicate}`,
): RewardRule {
  return { predicate, value, quotedClause };
}

const MANDATE: Mandate = {
  id: "m_1",
  capUsd: 1000,
  budgetUsd: 1000,
  approvalThresholdUsd: 500,
  allowCategories: ["headphones"],
  allowMerchants: ["bestbuy.com", "amazon.com"],
  expiresAt: FUTURE,
};

const INTENT: PurchaseIntent = { rawText: "sony headphones", category: "headphones" };

function isRejected(
  r: { appliedUsd: number } | RejectedReward,
): r is RejectedReward {
  return !("appliedUsd" in r);
}

// ─── evaluateReward: accepts ─────────────────────────────────────────
describe("evaluateReward — applies", () => {
  it("percent_off computes price * percent/100", () => {
    const r = reward({ valueUsd: 100, rules: [rule("percent_off", 20)] });
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(res).toEqual({ appliedUsd: 40 });
  });

  it("flat_off_usd applies the flat amount", () => {
    const r = reward({ valueUsd: 25, rules: [rule("flat_off_usd", 25)] });
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(res).toEqual({ appliedUsd: 25 });
  });

  it("giftcard with no amount rule uses face value", () => {
    const r = reward({ type: "giftcard", valueUsd: 40, rules: [] });
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(res).toEqual({ appliedUsd: 40 });
  });

  it("merchant_allow passes when the retailer is listed", () => {
    const r = reward({
      valueUsd: 30,
      rules: [rule("merchant_allow", ["bestbuy.com"]), rule("flat_off_usd", 30)],
    });
    const res = evaluateReward(r, offer({ retailer: "bestbuy.com" }));
    expect(res).toEqual({ appliedUsd: 30 });
  });
});

// ─── evaluateReward: rejects ─────────────────────────────────────────
describe("evaluateReward — rejects", () => {
  it("rejects an expired reward (status) and quotes the expires_on clause", () => {
    const r = reward({
      status: "expired",
      valueUsd: 50,
      rules: [rule("flat_off_usd", 50), rule("expires_on", PAST, "Expires 01/01/2020")],
    });
    const res = evaluateReward(r, offer());
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) {
      expect(res.reason).toBe("reward expired");
      expect(res.quotedClause).toBe("Expires 01/01/2020");
    }
  });

  it("rejects a reward whose expiresAt is in the past", () => {
    const r = reward({ status: "active", valueUsd: 50, expiresAt: PAST, rules: [rule("flat_off_usd", 50)] });
    const res = evaluateReward(r, offer());
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) expect(res.reason).toBe("reward expired");
  });

  it("rejects when min_spend_usd is not met", () => {
    const r = reward({
      valueUsd: 50,
      rules: [rule("min_spend_usd", 300, "Spend $300 or more"), rule("flat_off_usd", 50)],
    });
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) {
      expect(res.reason).toContain("minimum spend $300 not met");
      expect(res.quotedClause).toBe("Spend $300 or more");
    }
  });

  it("rejects when the offer's retailer is not in merchant_allow", () => {
    const r = reward({
      valueUsd: 50,
      rules: [rule("merchant_allow", ["amazon.com"], "Valid at Amazon only"), rule("flat_off_usd", 50)],
    });
    const res = evaluateReward(r, offer({ retailer: "bestbuy.com" }));
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) {
      expect(res.reason).toContain("bestbuy.com");
      expect(res.quotedClause).toBe("Valid at Amazon only");
    }
  });

  it("rejects when the retailer is in merchant_deny", () => {
    const r = reward({
      valueUsd: 50,
      rules: [rule("merchant_deny", ["bestbuy.com"], "Not valid at Best Buy"), rule("flat_off_usd", 50)],
    });
    const res = evaluateReward(r, offer({ retailer: "bestbuy.com" }));
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) expect(res.quotedClause).toBe("Not valid at Best Buy");
  });

  it("rejects when there is no applicable discount", () => {
    const r = reward({ type: "coupon", valueUsd: 0, rules: [] });
    const res = evaluateReward(r, offer());
    expect(isRejected(res)).toBe(true);
    if (isRejected(res)) expect(res.reason).toBe("no applicable discount");
  });
});

// ─── evaluateReward: caps ────────────────────────────────────────────
describe("evaluateReward — caps", () => {
  it("caps the discount at max_discount_usd", () => {
    const r = reward({
      valueUsd: 100,
      rules: [rule("percent_off", 50), rule("max_discount_usd", 30, "Max $30 off")],
    });
    // 50% of 200 = 100, capped at 30.
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(res).toEqual({ appliedUsd: 30 });
  });

  it("caps a giftcard at reward.valueUsd (a $50 card can't exceed $50)", () => {
    const r = reward({ type: "giftcard", valueUsd: 50, rules: [] });
    const res = evaluateReward(r, offer({ priceUsd: 200 }));
    expect(res).toEqual({ appliedUsd: 50 });
  });

  it("caps a giftcard at offer.priceUsd (can't discount below $0)", () => {
    const r = reward({ type: "giftcard", valueUsd: 50, rules: [] });
    const res = evaluateReward(r, offer({ priceUsd: 30 }));
    expect(res).toEqual({ appliedUsd: 30 });
  });
});

// ─── bestStack ───────────────────────────────────────────────────────
describe("bestStack", () => {
  it("picks only one reward from a not_combinable_group (the larger)", () => {
    const small = reward({
      id: "rw_small",
      valueUsd: 20,
      rules: [rule("flat_off_usd", 20), rule("not_combinable_group", "promo")],
    });
    const big = reward({
      id: "rw_big",
      valueUsd: 40,
      rules: [rule("flat_off_usd", 40), rule("not_combinable_group", "promo")],
    });
    const { applied, savedUsd } = bestStack(offer({ priceUsd: 200 }), [small, big]);
    expect(applied).toHaveLength(1);
    expect(applied[0].rewardId).toBe("rw_big");
    expect(savedUsd).toBe(40);
  });

  it("stacks two freely-combinable rewards", () => {
    const a = reward({ id: "rw_a", valueUsd: 30, rules: [rule("flat_off_usd", 30)] });
    const b = reward({ id: "rw_b", type: "giftcard", valueUsd: 25, rules: [] });
    const { applied, savedUsd } = bestStack(offer({ priceUsd: 200 }), [a, b]);
    expect(applied).toHaveLength(2);
    expect(savedUsd).toBe(55);
  });

  it("ignores rewards that do not apply to the offer", () => {
    const good = reward({ id: "rw_good", valueUsd: 30, rules: [rule("flat_off_usd", 30)] });
    const bad = reward({
      id: "rw_bad",
      valueUsd: 50,
      rules: [rule("merchant_allow", ["amazon.com"]), rule("flat_off_usd", 50)],
    });
    const { applied, savedUsd } = bestStack(offer({ retailer: "bestbuy.com" }), [good, bad]);
    expect(applied).toHaveLength(1);
    expect(applied[0].rewardId).toBe("rw_good");
    expect(savedUsd).toBe(30);
  });

  it("caps total savings at offer.priceUsd", () => {
    const a = reward({ id: "rw_a", type: "giftcard", valueUsd: 150, rules: [] });
    const b = reward({ id: "rw_b", type: "giftcard", valueUsd: 150, rules: [] });
    // Each giftcard alone is already capped to priceUsd (100) by evaluateReward,
    // and the stacked total cannot exceed priceUsd either.
    const { savedUsd } = bestStack(offer({ priceUsd: 100 }), [a, b]);
    expect(savedUsd).toBe(100);
  });
});

// ─── optimize ────────────────────────────────────────────────────────
describe("optimize", () => {
  it("ranks a higher sticker offer first when a bigger gift card wins (Best Buy cert beats Amazon)", () => {
    const bestBuy = offer({
      id: "bb",
      title: "Sony WH-1000XM5",
      priceUsd: 249,
      retailer: "bestbuy.com",
    });
    const amazon = offer({
      id: "az",
      title: "Sony WH-1000XM5",
      priceUsd: 229,
      retailer: "amazon.com",
    });
    const bbCert = reward({
      id: "rw_bbcert",
      type: "giftcard",
      valueUsd: 40,
      rules: [rule("merchant_allow", ["bestbuy.com"], "Redeemable at Best Buy")],
    });
    const result = optimize(INTENT, [amazon, bestBuy], [bbCert], MANDATE);

    expect(result.plans).toHaveLength(2);
    expect(result.plans[0].name).toBe("Cheapest after rewards");
    // Best Buy: 249 - 40 = 209 beats Amazon's 229.
    expect(result.plans[0].offer.id).toBe("bb");
    expect(result.plans[0].savedUsd).toBe(40);
    expect(result.plans[0].cashUsd).toBe(209);
    expect(result.plans[1].name).toBe("Alternative #2");
    expect(result.plans[1].offer.id).toBe("az");
    expect(result.plans[1].cashUsd).toBe(229);
  });

  it("returns empty plans and no rejections when no offers survive the price filter", () => {
    const pricey = offer({ priceUsd: 500 });
    const result = optimize(
      { ...INTENT, maxPriceUsd: 100 },
      [pricey],
      [reward({ valueUsd: 20, rules: [rule("flat_off_usd", 20)] })],
      MANDATE,
    );
    expect(result).toEqual({ plans: [], rejected: [] });
  });

  it("returns empty for an empty offer list", () => {
    expect(optimize(INTENT, [], [], MANDATE)).toEqual({ plans: [], rejected: [] });
  });

  it("filters offers above the intent's maxPriceUsd", () => {
    const cheap = offer({ id: "cheap", priceUsd: 80 });
    const dear = offer({ id: "dear", priceUsd: 300 });
    const result = optimize({ ...INTENT, maxPriceUsd: 100 }, [cheap, dear], [], MANDATE);
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].offer.id).toBe("cheap");
  });

  it("surfaces rejections for the winning offer (why a reward didn't apply)", () => {
    const win = offer({ id: "win", priceUsd: 200, retailer: "bestbuy.com" });
    const applies = reward({ id: "rw_applies", valueUsd: 30, rules: [rule("flat_off_usd", 30)] });
    const wrongMerchant = reward({
      id: "rw_wrong",
      valueUsd: 50,
      rules: [rule("merchant_allow", ["amazon.com"], "Amazon only"), rule("flat_off_usd", 50)],
    });
    const result = optimize(INTENT, [win], [applies, wrongMerchant], MANDATE);

    expect(result.plans[0].useRewards.map((a) => a.rewardId)).toContain("rw_applies");
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].rewardId).toBe("rw_wrong");
    expect(result.rejected[0].quotedClause).toBe("Amazon only");
  });

  it("caps a plan's cash at zero, never negative, for an oversized reward", () => {
    const o = offer({ id: "o", priceUsd: 30, retailer: "bestbuy.com" });
    const bigCard = reward({ id: "rw_big", type: "giftcard", valueUsd: 100, rules: [] });
    const result = optimize(INTENT, [o], [bigCard], MANDATE);
    expect(result.plans[0].savedUsd).toBe(30);
    expect(result.plans[0].cashUsd).toBe(0);
  });
});
