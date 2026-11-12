import { describe, it, expect } from "vitest";
import { computeStack, type Stackable } from "./compute";
import { DEMO_CONTEXT, DEMO_PRICE, DEMO_WALLET } from "./demo";

describe("computeStack — demo wallet vs $249.99 headphones at Best Buy", () => {
  const r = computeStack(DEMO_PRICE, DEMO_WALLET, DEMO_CONTEXT);

  it("applies coupon → tender (soonest-expiring first) in order, with running totals", () => {
    expect(r.steps.map((s) => [s.item.id, s.amountCents, s.runningCents])).toEqual([
      ["bby-10", 2500, 22499], // coupon first: 10% of 249.99
      ["bby-cert40", 4000, 18499], // tender, expiring soonest → used first
      ["bby-gc15", 1500, 16999], // tender, no expiry
      ["pp-cardrw", 1240, 15759], // tender, no expiry
    ]);
  });

  it("captures ONE PayPal payment and reports savings", () => {
    expect(r.payNowCents).toBe(15759); // $157.59
    expect(r.savedCents).toBe(9240);
    expect(r.backLaterCents).toBe(0);
  });

  it("rejects ineligible rewards with the specific failing clause", () => {
    expect(r.rejected.map((x) => [x.item.id, x.reason])).toEqual([
      ["tgt-20", "Only valid at Target"],
      ["amex-bby30", "Needs $300+ (order is $249.99)"],
      ["bby-app15", "Appliances only, not audio"],
      ["bby-5", "Expired 2 days ago"],
      ["sbux-15", "Only valid at Starbucks"],
    ]);
  });

  it("carries the T&C clauses each applied reward passed", () => {
    expect(r.steps[0].checks.map((c) => c.label)).toEqual([
      "Not expired",
      "Valid at Best Buy",
      "Audio eligible",
      "Up to $40",
    ]);
    expect(r.steps[1].checks.map((c) => c.label)).toEqual(["Expires in 6d", "Valid at Best Buy"]);
  });

  it("invariant: pay now + checkout savings == price", () => {
    const saved = r.steps
      .filter((s) => s.when === "checkout")
      .reduce((a, s) => a + s.amountCents, 0);
    expect(r.payNowCents + saved).toBe(r.priceCents);
  });
});

describe("computeStack — edge cases", () => {
  it("coupon exclusivity keeps the single most valuable coupon", () => {
    const two = computeStack(200, [
      { id: "a", label: "A 10%", kind: "", domain: "x.com", type: "pct_off", value: 10, exclusiveCoupon: true, clause: "" },
      { id: "b", label: "B $5", kind: "", domain: "x.com", type: "amount_off", value: 5, clause: "" },
    ]);
    expect(two.steps.map((s) => s.item.id)).toEqual(["a"]);
    expect(two.rejected[0].reason).toBe("Can't combine with A 10%");
  });

  it("tender never pushes below zero; the extra one is rejected", () => {
    const gc: Stackable[] = [
      { id: "g1", label: "GC1", kind: "", domain: "x.com", type: "gift_card", value: 30, clause: "" },
      { id: "g2", label: "GC2", kind: "", domain: "x.com", type: "gift_card", value: 30, clause: "" },
    ];
    const small = computeStack(20, gc);
    expect(small.payNowCents).toBe(0);
    expect(small.rejected[0].item.id).toBe("g2");
  });

  it("statement credit is after payment — it does not change the PayPal amount", () => {
    const sc = computeStack(400, [
      { id: "s", label: "S", kind: "", domain: "x.com", type: "statement_credit", value: 30, minSpendUsd: 300, clause: "" },
    ]);
    expect(sc.payNowCents).toBe(40000);
    expect(sc.backLaterCents).toBe(3000);
  });
});
