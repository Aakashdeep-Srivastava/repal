import { describe, it, expect } from "vitest";
import { assertGrounded } from "@/lib/tnc/groundingGuard";
import type { ParsedTerms } from "@/lib/tnc/schema";

function terms(rules: ParsedTerms["rules"]): ParsedTerms {
  return { rules, parseConfidence: 0.9 };
}

describe("assertGrounded", () => {
  it("passes when clause and number are both present in source", () => {
    const source = "Spend a minimum of $50 to unlock this reward.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 50,
        quotedClause: "minimum of $50",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("throws on an ungrounded number (rule says 60, source says 50)", () => {
    const source = "Spend a minimum of $50 to unlock this reward.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 60,
        quotedClause: "minimum of $50",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).toThrow(/ungrounded number: 60/);
  });

  it("throws on an ungrounded clause not found in source", () => {
    const source = "Spend a minimum of $50 to unlock this reward.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 50,
        quotedClause: "spend at least fifty dollars",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).toThrow(
      /ungrounded clause: "spend at least fifty dollars"/,
    );
  });

  it("tolerates currency/decimal formatting: 50 grounds against $50.00", () => {
    const source = "Minimum purchase of $50.00 required.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 50,
        quotedClause: "Minimum purchase of $50.00",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("tolerates thousands separators: 1000 grounds against 1,000 (and vice versa)", () => {
    const source = "Maximum discount is 1,000 points.";
    const parsed = terms([
      {
        predicate: "max_discount_usd",
        value: 1000,
        quotedClause: "Maximum discount is 1,000 points",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();

    // reverse direction: value carries the comma, source is plain
    const source2 = "Maximum discount is 1000 points.";
    const parsed2 = terms([
      {
        predicate: "max_discount_usd",
        value: "1,000 points",
        quotedClause: "Maximum discount is 1000 points",
      },
    ]);
    expect(() => assertGrounded(parsed2, source2)).not.toThrow();
  });

  it("treats 50 and 50.0 as numerically equal", () => {
    const source = "Spend $50 minimum.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 50.0,
        quotedClause: "Spend $50 minimum",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("tolerates whitespace runs and case differences in the clause", () => {
    const source = "Spend a MINIMUM   of\n\t$50 to qualify.";
    const parsed = terms([
      {
        predicate: "min_spend_usd",
        value: 50,
        quotedClause: "minimum of $50",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("grounds a percent rule: 5 grounds against 5%", () => {
    const source = "Get 5% off your next order.";
    const parsed = terms([
      {
        predicate: "percent_off",
        value: 5,
        quotedClause: "5% off",
      },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("does not decompose expires_on date into grounded numbers", () => {
    const source = "This offer expires on 2027-01-31.";
    const parsed = terms([
      {
        predicate: "expires_on",
        value: "2027-01-31",
        quotedClause: "expires on 2027-01-31",
      },
    ]);
    // The date components (2027, 01, 31) are not independently required; the
    // quotedClause substring check covers grounding.
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("grounds numbers embedded in array values", () => {
    const source = "Valid on electronics and apparel over $25.";
    const parsed = terms([
      {
        predicate: "category_allow",
        value: ["electronics", "apparel"],
        quotedClause: "electronics and apparel",
      },
    ]);
    // No numbers in the array values -> nothing to ground beyond the clause.
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });

  it("passes a multi-rule parse where every rule is grounded", () => {
    const source =
      "Spend a minimum of $50 and get 10% off. Max discount $20. Expires on 2027-12-01.";
    const parsed = terms([
      { predicate: "min_spend_usd", value: 50, quotedClause: "minimum of $50" },
      { predicate: "percent_off", value: 10, quotedClause: "get 10% off" },
      { predicate: "max_discount_usd", value: 20, quotedClause: "Max discount $20" },
      { predicate: "expires_on", value: "2027-12-01", quotedClause: "Expires on 2027-12-01" },
    ]);
    expect(() => assertGrounded(parsed, source)).not.toThrow();
  });
});
