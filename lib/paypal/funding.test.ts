import { describe, it, expect } from "vitest";
import { selectFunding, isFundingSource } from "@/lib/paypal/funding";

describe("selectFunding — the agent's funding brain", () => {
  it("recommends Pay Later for big-ticket amounts (>= $100)", () => {
    const c = selectFunding(240);
    expect(c.chosen.source).toBe("pay_later");
    expect(c.reason).toMatch(/4 interest-free payments/i);
    // Instalment math is quoted honestly (~$60 of $240).
    expect(c.chosen.tagline).toContain("$60.00");
    // Alternatives are offered as overrides and never include the chosen one.
    expect(c.alternatives.map((a) => a.source)).not.toContain("pay_later");
  });

  it("recommends Venmo for small / everyday amounts (<= $30)", () => {
    const c = selectFunding(18);
    expect(c.chosen.source).toBe("venmo");
    expect(c.alternatives.map((a) => a.source)).toContain("paypal");
  });

  it("recommends instant PayPal balance for the mid-range", () => {
    const c = selectFunding(55);
    expect(c.chosen.source).toBe("paypal");
    expect(c.reason).toContain("$55.00");
  });

  it("is deterministic — same amount always yields the same choice", () => {
    expect(selectFunding(150).chosen.source).toBe(selectFunding(150).chosen.source);
  });

  it("boundaries: $100 -> Pay Later, $30 -> Venmo", () => {
    expect(selectFunding(100).chosen.source).toBe("pay_later");
    expect(selectFunding(30).chosen.source).toBe("venmo");
  });

  it("handles zero / non-finite amounts without throwing", () => {
    expect(selectFunding(0).chosen.source).toBe("paypal");
    expect(selectFunding(Number.NaN).chosen.source).toBe("paypal");
    expect(selectFunding(-10).chosen.source).toBe("paypal");
  });

  it("always offers exactly two distinct alternatives", () => {
    for (const amt of [10, 55, 300]) {
      const c = selectFunding(amt);
      const sources = new Set([c.chosen.source, ...c.alternatives.map((a) => a.source)]);
      expect(sources.size).toBe(3); // chosen + 2 alts cover all three methods
    }
  });
});

describe("isFundingSource", () => {
  it("accepts the three valid sources", () => {
    expect(isFundingSource("paypal")).toBe(true);
    expect(isFundingSource("pay_later")).toBe(true);
    expect(isFundingSource("venmo")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isFundingSource("card")).toBe(false);
    expect(isFundingSource("")).toBe(false);
    expect(isFundingSource(undefined)).toBe(false);
    expect(isFundingSource(42)).toBe(false);
  });
});
