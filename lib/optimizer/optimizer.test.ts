import { describe, it, expect } from "vitest";
import type { Mandate, Offer, PurchaseIntent, Reward, RewardRule } from "@/lib/types";
import { evaluateReward, isRejected, MIN_PARSE_CONFIDENCE } from "./evaluate";
import { bestStack } from "./stack";
import { optimize, PLAN_CHEAPEST, PLAN_KEEP_POINTS } from "./index";

const NOW = new Date("2026-11-04T12:00:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();
const ctx = { category: "headphones", now: NOW };

const rule = (predicate: string, value: RewardRule["value"], quotedClause = predicate): RewardRule => ({
  predicate,
  value,
  quotedClause,
});

let seq = 0;
const reward = (rules: RewardRule[], over: Partial<Reward> = {}): Reward => ({
  id: over.id ?? `r${++seq}`,
  source: "seed",
  type: "coupon",
  valueUsd: 0,
  termsRaw: "",
  rules,
  status: "active",
  parseConfidence: 1,
  expiresAt: inDays(30),
  ...over,
});

const offer = (id: string, priceUsd: number, retailer: string): Offer => ({
  id,
  title: `Headphones ${id}`,
  priceUsd,
  retailer,
  buyUrl: `https://${retailer}/${id}`,
});

const bestBuy = offer("bb", 279.99, "bestbuy.com");
const amazon = offer("amz", 249.99, "amazon.com");

const mandate: Mandate = {
  id: "m_1",
  capUsd: 300,
  budgetUsd: 500,
  approvalThresholdUsd: 200,
  allowCategories: ["electronics", "audio"],
  allowMerchants: [],
  expiresAt: inDays(90),
};
const intent: PurchaseIntent = { rawText: "headphones under $250", category: "headphones" };

const rejection = (r: ReturnType<typeof evaluateReward>) => {
  if (!isRejected(r)) throw new Error(`expected rejection, got ${JSON.stringify(r)}`);
  return r;
};

// ─── evaluateReward ──────────────────────────────────────────────────
describe("evaluateReward", () => {
  it("applies a flat discount", () => {
    expect(evaluateReward(reward([rule("flat_off_usd", 25)]), bestBuy, ctx)).toEqual({ appliedUsd: 25 });
  });

  it("applies percent off floored to the cent, capped by max_discount_usd", () => {
    const pct = reward([rule("percent_off", 5)]);
    expect(evaluateReward(pct, bestBuy, ctx)).toEqual({ appliedUsd: 13.99 }); // 5% of 279.99 = 13.9995
    const capped = reward([rule("percent_off", 5), rule("max_discount_usd", 10)]);
    expect(evaluateReward(capped, bestBuy, ctx)).toEqual({ appliedUsd: 10 });
  });

  it("falls back to the wallet value (gift card balance) when no amount rule exists", () => {
    expect(evaluateReward(reward([], { valueUsd: 40 }), bestBuy, ctx)).toEqual({ appliedUsd: 40 });
  });

  it("never discounts more than the price", () => {
    const cheap = offer("c", 20, "bestbuy.com");
    expect(evaluateReward(reward([rule("flat_off_usd", 50)]), cheap, ctx)).toEqual({ appliedUsd: 20 });
  });

  it("rejects expired rewards (status, wallet expiry, expires_on rule)", () => {
    expect(rejection(evaluateReward(reward([], { status: "expired", valueUsd: 9 }), bestBuy, ctx)).reason).toBe("Expired");
    expect(rejection(evaluateReward(reward([], { expiresAt: inDays(-1), valueUsd: 9 }), bestBuy, ctx)).reason).toMatch(/^Expired on/);
    const r = rejection(
      evaluateReward(reward([rule("flat_off_usd", 9), rule("expires_on", "2026-11-03", "valid through Nov 3, 2026")]), bestBuy, ctx),
    );
    expect(r.reason).toBe("Expired on 2026-11-03");
    expect(r.quotedClause).toBe("valid through Nov 3, 2026");
  });

  it("an expires_on date is valid through the end of that day", () => {
    const r = reward([rule("flat_off_usd", 9), rule("expires_on", "2026-11-04")]);
    expect(isRejected(evaluateReward(r, bestBuy, ctx))).toBe(false);
  });

  it("rejects used rewards", () => {
    expect(rejection(evaluateReward(reward([], { status: "used", valueUsd: 9 }), bestBuy, ctx)).reason).toBe("Already used");
  });

  it("does not auto-apply low-confidence parses", () => {
    const r = rejection(evaluateReward(reward([rule("flat_off_usd", 9)], { parseConfidence: 0.6 }), bestBuy, ctx));
    expect(r.reason).toMatch(/not confidently parsed .*not auto-applied/);
    expect(isRejected(evaluateReward(reward([rule("flat_off_usd", 9)], { parseConfidence: MIN_PARSE_CONFIDENCE }), bestBuy, ctx))).toBe(false);
  });

  it("rejects a merchant mismatch with the quoted clause", () => {
    const r = rejection(evaluateReward(reward([rule("flat_off_usd", 25), rule("merchant_allow", ["Best Buy"], "at Best Buy")]), amazon, ctx));
    expect(r.reason).toMatch(/Merchant mismatch: only valid at Best Buy, not amazon\.com/);
    expect(r.quotedClause).toBe("at Best Buy");
  });

  it("rejects an excluded merchant", () => {
    expect(rejection(evaluateReward(reward([rule("flat_off_usd", 9), rule("merchant_deny", ["Amazon"])]), amazon, ctx)).reason).toMatch(/Merchant excluded/);
  });

  it("checks categories through the parent map", () => {
    expect(isRejected(evaluateReward(reward([rule("flat_off_usd", 9), rule("category_allow", ["electronics"])]), bestBuy, ctx))).toBe(false);
    const r = rejection(evaluateReward(reward([rule("flat_off_usd", 9), rule("category_allow", ["dining"], "at participating restaurants")]), bestBuy, ctx));
    expect(r.reason).toMatch(/Category mismatch: valid for dining, not headphones/);
    expect(rejection(evaluateReward(reward([rule("flat_off_usd", 9), rule("category_deny", ["electronics"])]), bestBuy, ctx)).reason).toMatch(/Category excluded/);
  });

  it("rejects when minimum spend is not met (and allows exactly at it)", () => {
    const r = rejection(evaluateReward(reward([rule("flat_off_usd", 30), rule("min_spend_usd", 300, "over $300")]), bestBuy, ctx));
    expect(r.reason).toBe("Minimum spend not met: requires $300.00, price is $279.99");
    const exact = offer("e", 100, "bestbuy.com");
    expect(isRejected(evaluateReward(reward([rule("flat_off_usd", 25), rule("min_spend_usd", 100)]), exact, ctx))).toBe(false);
  });

  it("rejects low-value rewards under 2% of the price", () => {
    const r = rejection(evaluateReward(reward([rule("flat_off_usd", 5)]), bestBuy, ctx)); // 5 < 5.5999
    expect(r.reason).toMatch(/Low value for this purchase: \$5\.00 is under 2% of \$279\.99/);
  });

  it("rejects a reward with nothing to redeem", () => {
    expect(rejection(evaluateReward(reward([]), bestBuy, ctx)).reason).toMatch(/No redeemable value/);
  });
});

// ─── bestStack ───────────────────────────────────────────────────────
describe("bestStack", () => {
  it("finds the exact best stack where greedy would waste value", () => {
    // Price 100: greedy takes 60 + 50 (wastes 10); exact picks 60 + 40 (wastes 0).
    const p = offer("p", 100, "x.com");
    const r60 = reward([rule("flat_off_usd", 60)], { id: "r60" });
    const r50 = reward([rule("flat_off_usd", 50)], { id: "r50" });
    const r40 = reward([rule("flat_off_usd", 40)], { id: "r40" });
    const s = bestStack(p, [r60, r50, r40], ctx);
    expect(s.savedUsd).toBe(100);
    expect(s.applied.map((a) => a.rewardId).sort()).toEqual(["r40", "r60"]);
    expect(s.unused).toEqual([{ rewardId: "r50", reason: "Not needed: price already fully covered by other rewards" }]);
  });

  it("allows at most one reward per not_combinable_group", () => {
    const g = (id: string, v: number) =>
      reward([rule("flat_off_usd", v), rule("not_combinable_group", "dining", "Cannot be combined with other dining offers")], { id });
    const s = bestStack(bestBuy, [g("d10", 10), g("d15", 15), reward([rule("flat_off_usd", 20)], { id: "free" })], ctx);
    expect(s.applied.map((a) => a.rewardId).sort()).toEqual(["d15", "free"]);
    expect(s.savedUsd).toBe(35);
    expect(s.unused).toEqual([
      {
        rewardId: "d10",
        reason: 'Stacking conflict: cannot be combined with d15 (group "dining")',
        quotedClause: "Cannot be combined with other dining offers",
      },
    ]);
  });

  it("prefers sooner-expiring rewards on ties and applies them first", () => {
    const p = offer("p", 30, "x.com");
    const late = reward([rule("flat_off_usd", 20)], { id: "late", expiresAt: inDays(60) });
    const soon = reward([rule("flat_off_usd", 20)], { id: "soon", expiresAt: inDays(5) });
    const ten = reward([rule("flat_off_usd", 10)], { id: "ten", expiresAt: inDays(90) });
    const s = bestStack(p, [late, soon, ten], ctx);
    expect(s.savedUsd).toBe(30);
    expect(s.applied).toEqual([
      { rewardId: "soon", appliedUsd: 20 },
      { rewardId: "ten", appliedUsd: 10 },
    ]);
  });

  it("applies the last reward partially when the stack over-covers the price", () => {
    const p = offer("p", 30, "x.com");
    const s = bestStack(p, [reward([rule("flat_off_usd", 25)], { id: "a", expiresAt: inDays(1) }), reward([rule("flat_off_usd", 25)], { id: "b", expiresAt: inDays(2) })], ctx);
    expect(s.applied).toEqual([
      { rewardId: "a", appliedUsd: 25 },
      { rewardId: "b", appliedUsd: 5 },
    ]);
    expect(s.savedUsd).toBe(30);
  });

  it("returns an empty stack when nothing applies", () => {
    const s = bestStack(bestBuy, [reward([], { status: "expired" })], ctx);
    expect(s).toMatchObject({ applied: [], savedUsd: 0, unused: [] });
    expect(s.rejected).toHaveLength(1);
  });

  it("is deterministic regardless of input order", () => {
    const rs = [10, 20, 30, 15, 25].map((v, i) => reward([rule("flat_off_usd", v)], { id: `x${i}` }));
    const a = bestStack(bestBuy, rs, ctx);
    const b = bestStack(bestBuy, [...rs].reverse(), ctx);
    expect(a).toEqual(b);
  });
});

// ─── optimize (the demo moment) ──────────────────────────────────────
describe("optimize", () => {
  const wallet: Reward[] = [
    reward([rule("flat_off_usd", 40, "$40 Best Buy gift certificate"), rule("merchant_allow", ["Best Buy"], "Best Buy gift certificate"), rule("category_allow", ["electronics"], "Redeemable on electronics only")], { id: "bb-gc-40", type: "giftcard" }),
    reward([rule("flat_off_usd", 25), rule("min_spend_usd", 100), rule("merchant_allow", ["Best Buy"], "at Best Buy")], { id: "chase-25", type: "cashback" }),
    reward([rule("flat_off_usd", 15), rule("min_spend_usd", 75), rule("category_allow", ["headphones", "audio"])], { id: "mc-15", type: "cashback" }),
    reward([rule("flat_off_usd", 10), rule("category_allow", ["dining"], "at participating restaurants")], { id: "amex-dining", type: "cashback" }),
    reward([], { id: "points-30", type: "points", valueUsd: 30 }),
    reward([rule("flat_off_usd", 9)], { id: "low-conf", parseConfidence: 0.5 }),
  ];

  it("a Best Buy certificate flips the winner vs a lower Amazon sticker", () => {
    const res = optimize(intent, [amazon, bestBuy], wallet, mandate, { now: NOW });
    const [a] = res.plans;
    expect(a.name).toBe(PLAN_CHEAPEST);
    expect(a.offer.id).toBe("bb");
    // 279.99 − (40 + 25 + 15 + 30 points) = 169.99; Amazon would be 249.99 − 45 = 204.99
    expect(a.savedUsd).toBe(110);
    expect(a.cashUsd).toBe(169.99);
  });

  it("Plan B keeps points", () => {
    const res = optimize(intent, [amazon, bestBuy], wallet, mandate, { now: NOW });
    const b = res.plans[1];
    expect(b.name).toBe(PLAN_KEEP_POINTS);
    expect(b.useRewards.map((r) => r.rewardId)).not.toContain("points-30");
    expect(b.cashUsd).toBe(199.99);
  });

  it("omits Plan B when it is identical to Plan A", () => {
    const res = optimize(intent, [bestBuy], wallet.filter((r) => r.type !== "points"), mandate, { now: NOW });
    expect(res.plans).toHaveLength(1);
  });

  it("explains every reward not used in Plan A, with quoted clauses", () => {
    const res = optimize(intent, [amazon, bestBuy], wallet, mandate, { now: NOW });
    const byId = Object.fromEntries(res.rejected.map((r) => [r.rewardId, r]));
    expect(Object.keys(byId).sort()).toEqual(["amex-dining", "low-conf"]);
    expect(byId["amex-dining"].quotedClause).toBe("at participating restaurants");
    expect(byId["low-conf"].reason).toMatch(/not auto-applied/);
  });

  it("prefers an offer the mandate allows over a cheaper denied one", () => {
    const res = optimize(intent, [amazon, bestBuy], wallet, { ...mandate, allowMerchants: ["Amazon"] }, { now: NOW });
    expect(res.plans[0].offer.id).toBe("amz");
  });

  it("still returns the best plan when every offer is denied (so policy can explain)", () => {
    const pricey = offer("p650", 650, "bestbuy.com");
    const res = optimize(intent, [pricey], [], mandate, { now: NOW });
    expect(res.plans[0].cashUsd).toBe(650);
  });

  it("treats intent.maxPriceUsd as a cap on cash paid", () => {
    const res = optimize({ ...intent, maxPriceUsd: 150 }, [amazon, bestBuy], wallet, mandate, { now: NOW });
    // Neither fits $150, so ranking falls back to cheapest cash: Best Buy at $169.99.
    expect(res.plans[0].offer.id).toBe("bb");
  });

  it("returns no plans and explains why when there are no offers", () => {
    const res = optimize(intent, [], wallet, mandate, { now: NOW });
    expect(res.plans).toEqual([]);
    expect(res.rejected).toHaveLength(wallet.length);
  });
});
