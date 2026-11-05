import { describe, it, expect } from "vitest";
import { assertGrounded, GroundingError, numbersIn, datesIn } from "./groundingGuard";
import type { ParsedTerms } from "./schema";

const SRC =
  "Spend $1,000 or more at participating restaurants and get 5% back, up to $50. " +
  "Offer valid through Dec 31, 2026. One-time use.";

const terms = (rules: ParsedTerms["rules"], parseConfidence = 1): ParsedTerms => ({ rules, parseConfidence });

describe("numbersIn / datesIn", () => {
  it("reads numbers with separators, symbols and decimals", () => {
    expect(numbersIn("$1,000 or ₹1000, 5%, $100+, 1.25x")).toEqual([1000, 1000, 5, 100, 1.25]);
  });

  it("reads the supported date formats", () => {
    expect(datesIn("valid through Dec 31, 2026")).toEqual(["2026-12-31"]);
    expect(datesIn("ends December 24th 2026")).toEqual(["2026-12-24"]);
    expect(datesIn("until 31 Jan 2027")).toEqual(["2027-01-31"]);
    expect(datesIn("by 2027-01-15 or 11/30/2026")).toEqual(["2027-01-15", "2026-11-30"]);
    expect(datesIn("Feb 30, 2027")).toEqual([]); // impossible date
  });
});

describe("assertGrounded", () => {
  it("accepts rules whose numbers and dates are in their quoted clauses", () => {
    expect(() =>
      assertGrounded(
        terms([
          { predicate: "min_spend_usd", value: 1000, quotedClause: "Spend $1,000 or more" },
          { predicate: "percent_off", value: 5, quotedClause: "get 5% back" },
          { predicate: "max_discount_usd", value: 50, quotedClause: "up to $50" },
          { predicate: "category_allow", value: ["dining"], quotedClause: "at participating restaurants" },
          { predicate: "expires_on", value: "2026-12-31", quotedClause: "valid through Dec 31, 2026" },
          { predicate: "one_time_use", value: "true", quotedClause: "One-time use" },
        ]),
        SRC,
      ),
    ).not.toThrow();
  });

  it("is case- and whitespace-insensitive for the quoted clause", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "percent_off", value: 5, quotedClause: "GET   5% back" }]), SRC),
    ).not.toThrow();
  });

  it("rejects an invented number", () => {
    const run = () => assertGrounded(terms([{ predicate: "max_discount_usd", value: 75, quotedClause: "up to $50" }]), SRC);
    expect(run).toThrow(GroundingError);
    expect(run).toThrow(/number 75 does not appear/);
  });

  it("rejects a number that exists elsewhere in the source but not in its own clause", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "max_discount_usd", value: 1000, quotedClause: "up to $50" }]), SRC),
    ).toThrow(/number 1000/);
  });

  it("rejects a percent written as a fraction", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "percent_off", value: 0.05, quotedClause: "get 5% back" }]), SRC),
    ).toThrow(/number 0.05/);
  });

  it("rejects a fabricated quoted clause", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "flat_off_usd", value: 10, quotedClause: "get $10 back" }]), SRC),
    ).toThrow(/quoted clause not found/);
  });

  it("rejects an expires_on that is not written in the clause, or a relative date", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "expires_on", value: "2026-12-30", quotedClause: "valid through Dec 31, 2026" }]), SRC),
    ).toThrow(/date 2026-12-30/);
    expect(() =>
      assertGrounded(
        terms([{ predicate: "expires_on", value: "2026-11-11", quotedClause: "EXPIRES IN 7 DAYS" }]),
        "Target eGiftCard worth $50 — EXPIRES IN 7 DAYS.",
      ),
    ).toThrow(GroundingError);
  });

  it("checks numbers embedded in string values", () => {
    expect(() =>
      assertGrounded(terms([{ predicate: "category_deny", value: ["4K TVs"], quotedClause: "at participating restaurants" }]), SRC),
    ).toThrow(/number 4/);
  });

  it("rejects input that fails the schema (unknown predicate)", () => {
    expect(() =>
      assertGrounded({ rules: [{ predicate: "free_money", value: 1, quotedClause: "x" }], parseConfidence: 1 } as unknown as ParsedTerms, SRC),
    ).toThrow();
  });
});
