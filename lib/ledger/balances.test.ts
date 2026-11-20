import { describe, it, expect } from "vitest";
import { rollupBalances } from "./balances";
import { summarisePayable } from "./settle";

describe("rollupBalances", () => {
  it("nets media credits (grant +, consume −), never conflating with cash", () => {
    const b = rollupBalances({
      mediaCredits: [
        { direction: "grant", amountCents: 10_000 },
        { direction: "consume", amountCents: 2_500 },
      ],
      cashback: [],
      commissions: [],
    });
    expect(b.mediaCreditCents).toBe(7_500);
  });

  it("counts only unpaid, un-reversed cashback as a liability", () => {
    const b = rollupBalances({
      mediaCredits: [],
      cashback: [
        { status: "accrued", amountCents: 500 },
        { status: "payable", amountCents: 300 },
        { status: "paid", amountCents: 999 }, // money gone — not a liability
        { status: "reversed", amountCents: 999 }, // unwound — not a liability
      ],
      commissions: [],
    });
    expect(b.cashbackLiabilityCents).toBe(800);
  });

  it("treats only publisher commission as payable; RePal's own is earned, not owed", () => {
    const b = rollupBalances({
      mediaCredits: [],
      cashback: [],
      commissions: [
        { party: "publisher", status: "pending", amountCents: 200 },
        { party: "publisher", status: "payable", amountCents: 100 },
        { party: "publisher", status: "paid", amountCents: 50 }, // settled — not payable
        { party: "repal", status: "pending", amountCents: 600 },
        { party: "repal", status: "reversed", amountCents: 99 },
      ],
    });
    expect(b.commissionPayableCents).toBe(300); // publisher pending + payable
    expect(b.repalEarnedCents).toBe(600); // repal, non-reversed
  });

  it("is all-zero on empty input", () => {
    expect(rollupBalances({ mediaCredits: [], cashback: [], commissions: [] })).toEqual({
      mediaCreditCents: 0,
      cashbackLiabilityCents: 0,
      commissionPayableCents: 0,
      repalEarnedCents: 0,
    });
  });
});

describe("summarisePayable", () => {
  it("totals publisher commission + customer cashback currently payable", () => {
    const s = summarisePayable(
      [
        { party: "publisher", status: "pending", amountCents: 200 },
        { party: "publisher", status: "payable", amountCents: 100 },
        { party: "repal", status: "pending", amountCents: 600 }, // RePal's own fee is not paid out
      ],
      [
        { status: "accrued", amountCents: 500 },
        { status: "paid", amountCents: 999 },
      ],
    );
    expect(s).toEqual({ publisherCommissionCents: 300, customerCashbackCents: 500, totalCents: 800 });
  });
});
