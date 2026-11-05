import { describe, it, expect } from "vitest";
import { checkPolicy } from "./index";
import type { Mandate, Plan, PurchaseIntent } from "@/lib/types";

const NOW = new Date("2026-11-04T12:00:00Z");

const mandate: Mandate = {
  id: "m_1",
  capUsd: 300,
  budgetUsd: 500,
  approvalThresholdUsd: 200,
  allowCategories: ["electronics", "audio", "dining", "travel"],
  allowMerchants: [],
  expiresAt: "2027-02-01T00:00:00Z",
};

const intent: PurchaseIntent = { rawText: "headphones under $250", category: "headphones" };

const plan = (cashUsd: number, retailer = "bestbuy.com"): Plan => ({
  name: "Cheapest after rewards",
  offer: { id: "o1", title: "Headphones", priceUsd: cashUsd, retailer, buyUrl: "" },
  useRewards: [],
  savedUsd: 0,
  cashUsd,
});

const check = (p: Plan, m: Partial<Mandate> = {}, ctx = {}) =>
  checkPolicy(intent, p, { ...mandate, ...m }, { now: NOW, ...ctx });

describe("checkPolicy", () => {
  it("allows a purchase within every limit", () => {
    expect(check(plan(150))).toEqual({ decision: "allow", reasons: [] });
  });

  it("asks when cash is above the approval threshold but within cap", () => {
    const r = check(plan(250));
    expect(r.decision).toBe("ask");
    expect(r.reasons[0]).toMatch(/\$250\.00 is above the \$200\.00 approval threshold/);
  });

  it("allows exactly at the threshold and exactly at the cap boundary rules", () => {
    expect(check(plan(200)).decision).toBe("allow");
    expect(check(plan(300)).decision).toBe("ask"); // = cap is fine, > threshold asks
  });

  it("denies above the per-purchase cap (the refused $650 demo beat)", () => {
    const r = check(plan(650));
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toMatch(/\$650\.00 exceeds the per-purchase cap of \$300\.00/);
  });

  it("is not fooled by float drift", () => {
    expect(check(plan(0.1 + 0.2), { capUsd: 0.3, approvalThresholdUsd: 0.3 }).decision).toBe(
      "allow",
    );
  });

  it("denies an expired mandate", () => {
    const r = check(plan(10), { expiresAt: "2026-11-01T00:00:00Z" });
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toMatch(/Mandate expired/);
  });

  it("denies a mandate with an invalid expiry", () => {
    expect(check(plan(10), { expiresAt: "soon" }).decision).toBe("deny");
  });

  it("matches categories through the parent map (headphones → audio → electronics)", () => {
    expect(check(plan(10), { allowCategories: ["electronics"] }).decision).toBe("allow");
    const r = check(plan(10), { allowCategories: ["dining"] });
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toMatch(/Category "headphones" is not allowed/);
  });

  it("treats empty allow-lists as no restriction", () => {
    expect(check(plan(10), { allowCategories: [], allowMerchants: [] }).decision).toBe("allow");
  });

  it("enforces the merchant allow-list against retailer domains", () => {
    expect(check(plan(10, "www.bestbuy.com"), { allowMerchants: ["Best Buy"] }).decision).toBe(
      "allow",
    );
    const r = check(plan(10, "amazon.com"), { allowMerchants: ["Best Buy"] });
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toMatch(/Merchant "amazon\.com" is not allowed/);
  });

  it("checks the budget only when spentUsd is supplied", () => {
    expect(check(plan(150)).decision).toBe("allow");
    expect(check(plan(150), {}, { spentUsd: 350 }).decision).toBe("allow"); // exactly 500
    const r = check(plan(150), {}, { spentUsd: 400 });
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toMatch(/Budget exceeded/);
  });

  it("accumulates every reason and lets deny win over ask", () => {
    const r = check(plan(650, "amazon.com"), {
      allowMerchants: ["Best Buy"],
      expiresAt: "2026-01-01T00:00:00Z",
    });
    expect(r.decision).toBe("deny");
    expect(r.reasons).toHaveLength(4); // expired, cap, merchant, + threshold ask
  });
});
