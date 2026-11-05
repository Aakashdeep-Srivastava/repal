import { describe, it, expect } from "vitest";
import { checkPolicy } from "@/lib/policy";
import type { Mandate, Plan, PurchaseIntent } from "@/lib/types";

// A mandate that expires far in the future; tests override fields as needed.
const baseMandate: Mandate = {
  id: "m_1",
  capUsd: 300,
  budgetUsd: 500,
  approvalThresholdUsd: 200,
  allowCategories: ["electronics", "audio"],
  allowMerchants: ["bestbuy.com", "amazon.com"],
  expiresAt: "2999-01-31T00:00:00.000Z",
};

function makeIntent(over: Partial<PurchaseIntent> = {}): PurchaseIntent {
  return { rawText: "buy headphones", category: "audio", ...over };
}

function makePlan(over: Partial<Plan> = {}): Plan {
  return {
    name: "Cheapest after rewards",
    offer: {
      id: "o_1",
      title: "Noise-cancelling headphones",
      priceUsd: 150,
      retailer: "bestbuy.com",
      buyUrl: "https://bestbuy.com/o_1",
    },
    useRewards: [],
    savedUsd: 0,
    cashUsd: 150,
    ...over,
  };
}

describe("checkPolicy", () => {
  it("allows when under threshold and category + merchant are permitted", () => {
    const result = checkPolicy(makeIntent(), makePlan({ cashUsd: 150 }), baseMandate);
    expect(result.decision).toBe("allow");
    expect(result.reasons).toEqual([]);
  });

  it("asks when above the approval threshold but under the cap", () => {
    // threshold 200, cap 300
    const result = checkPolicy(makeIntent(), makePlan({ cashUsd: 250 }), baseMandate);
    expect(result.decision).toBe("ask");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("$250.00");
    expect(result.reasons[0]).toContain("$200.00");
  });

  it("denies when over the per-transaction cap", () => {
    const result = checkPolicy(makeIntent(), makePlan({ cashUsd: 350 }), baseMandate);
    expect(result.decision).toBe("deny");
    expect(result.reasons).toContain("$350.00 exceeds per-transaction cap of $300.00");
  });

  it("denies when the category is not in the allow-list", () => {
    const result = checkPolicy(
      makeIntent({ category: "furniture" }),
      makePlan({ cashUsd: 100 }),
      baseMandate,
    );
    expect(result.decision).toBe("deny");
    expect(result.reasons).toContain("category 'furniture' not in allow-list");
  });

  it("denies when the merchant is not in the allow-list", () => {
    const result = checkPolicy(
      makeIntent(),
      makePlan({
        cashUsd: 100,
        offer: { ...makePlan().offer, retailer: "sketchy-shop.com" },
      }),
      baseMandate,
    );
    expect(result.decision).toBe("deny");
    expect(result.reasons).toContain("merchant 'sketchy-shop.com' not allowed");
  });

  it("denies an expired mandate", () => {
    const expired: Mandate = { ...baseMandate, expiresAt: "2020-06-15T00:00:00.000Z" };
    const result = checkPolicy(makeIntent(), makePlan({ cashUsd: 100 }), expired);
    expect(result.decision).toBe("deny");
    expect(result.reasons).toContain("mandate expired on 2020-06-15");
  });

  it("treats empty allowCategories / allowMerchants as no restriction (allow)", () => {
    const open: Mandate = { ...baseMandate, allowCategories: [], allowMerchants: [] };
    const result = checkPolicy(
      makeIntent({ category: "anything-goes" }),
      makePlan({
        cashUsd: 100,
        offer: { ...makePlan().offer, retailer: "any-store.com" },
      }),
      open,
    );
    expect(result.decision).toBe("allow");
    expect(result.reasons).toEqual([]);
  });

  it("accumulates multiple deny reasons", () => {
    const expired: Mandate = { ...baseMandate, expiresAt: "2020-01-01T00:00:00.000Z" };
    const result = checkPolicy(
      makeIntent({ category: "furniture" }),
      makePlan({
        cashUsd: 999,
        offer: { ...makePlan().offer, retailer: "sketchy-shop.com" },
      }),
      expired,
    );
    expect(result.decision).toBe("deny");
    // expired + over-cap + bad category + bad merchant
    expect(result.reasons).toHaveLength(4);
    expect(result.reasons).toContain("mandate expired on 2020-01-01");
    expect(result.reasons).toContain("$999.00 exceeds per-transaction cap of $300.00");
    expect(result.reasons).toContain("category 'furniture' not in allow-list");
    expect(result.reasons).toContain("merchant 'sketchy-shop.com' not allowed");
  });
});
