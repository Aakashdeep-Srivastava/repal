import { describe, it, expect } from "vitest";
import { computeCommission, computeCashbackCents, DEFAULT_REPAL_FEE_BPS } from "./commission";

describe("computeCommission", () => {
  it("splits RePal's fee and the publisher's carved-out share", () => {
    // $100 settled, RePal 8% = $8.00, publisher 25% OF that = $2.00, RePal nets $6.00
    const s = computeCommission(10_000, 800, 2500);
    expect(s).toEqual({ baseCents: 10_000, repalFeeCents: 800, publisherCents: 200, repalNetCents: 600 });
  });

  it("floors both steps (never rounds up money)", () => {
    // 333c * 8% = 26.64 → 26; 26 * 25% = 6.5 → 6; net 20
    const s = computeCommission(333, 800, 2500);
    expect(s.repalFeeCents).toBe(26);
    expect(s.publisherCents).toBe(6);
    expect(s.repalNetCents).toBe(20);
  });

  it("gives the publisher nothing when revShareBps is 0", () => {
    const s = computeCommission(10_000, DEFAULT_REPAL_FEE_BPS, 0);
    expect(s.publisherCents).toBe(0);
    expect(s.repalNetCents).toBe(s.repalFeeCents);
  });

  it("is zero on a zero base", () => {
    expect(computeCommission(0, 800, 2500)).toEqual({
      baseCents: 0,
      repalFeeCents: 0,
      publisherCents: 0,
      repalNetCents: 0,
    });
  });

  it("never lets the publisher share exceed RePal's fee", () => {
    const s = computeCommission(99_999, 800, 9999);
    expect(s.publisherCents).toBeLessThanOrEqual(s.repalFeeCents);
    expect(s.repalNetCents).toBeGreaterThanOrEqual(0);
  });

  it("rejects non-integer cents", () => {
    expect(() => computeCommission(100.5, 800, 2500)).toThrow();
  });
});

describe("computeCashbackCents", () => {
  it("accrues a percentage of spend for cashback_pct", () => {
    // 5% of $100 = $5.00
    expect(computeCashbackCents("cashback_pct", 5, 10_000)).toBe(500);
  });

  it("caps cashback at maxRewardCents", () => {
    expect(computeCashbackCents("cashback_pct", 5, 10_000, 300)).toBe(300);
  });

  it("treats welcome_cash / statement_credit as a flat USD amount", () => {
    expect(computeCashbackCents("welcome_cash", 10, 10_000)).toBe(1_000);
    expect(computeCashbackCents("statement_credit", 2.5, 10_000)).toBe(250);
  });

  it("never exceeds the base spend", () => {
    expect(computeCashbackCents("welcome_cash", 10, 500)).toBe(500);
  });

  it("returns 0 for offer types that reduce price, not cashback", () => {
    expect(computeCashbackCents("pct_off", 25, 10_000)).toBe(0);
    expect(computeCashbackCents("amount_off", 5, 10_000)).toBe(0);
    expect(computeCashbackCents("free_shipping", 0, 10_000)).toBe(0);
  });
});
