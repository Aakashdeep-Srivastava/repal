import { describe, it, expect } from "vitest";
import { categoryLineage, categoryMatches } from "./categories";
import { merchantKey, merchantMatches } from "./merchants";

describe("categories", () => {
  it("walks the parent chain", () => {
    expect(categoryLineage("Headphones")).toEqual(["headphones", "audio", "electronics"]);
    expect(categoryLineage("restaurants")).toEqual(["restaurants", "dining"]);
    expect(categoryLineage("unknown thing")).toEqual(["unknown thing"]);
  });

  it("matches via ancestors, not descendants", () => {
    expect(categoryMatches("headphones", ["electronics"])).toBe(true);
    expect(categoryMatches("electronics", ["headphones"])).toBe(false);
    expect(categoryMatches("headphones", ["dining"])).toBe(false);
  });

  it("supports * and is case/space-insensitive", () => {
    expect(categoryMatches("anything", ["*"])).toBe(true);
    expect(categoryMatches("Home  Goods", ["HOME"])).toBe(true);
  });
});

describe("merchants", () => {
  it("normalizes names and domains to the same key", () => {
    expect(merchantKey("Best Buy")).toBe("bestbuy");
    expect(merchantKey("https://www.bestbuy.com/site/x")).toBe("bestbuy");
    expect(merchantKey("us.sennheiser-hearing.com")).toBe("sennheiserhearing");
    expect(merchantKey("Macy's")).toBe("macys");
  });

  it("matches equal keys and long-enough prefixes", () => {
    expect(merchantMatches("bestbuy.com", ["Best Buy"])).toBe(true);
    expect(merchantMatches("us.sennheiser-hearing.com", ["Sennheiser"])).toBe(true);
    expect(merchantMatches("amazon.com", ["Best Buy"])).toBe(false);
  });

  it("does not prefix-match very short keys", () => {
    expect(merchantMatches("hpstore.com", ["HP"])).toBe(false);
  });

  it("supports *", () => {
    expect(merchantMatches("anything.com", ["*"])).toBe(true);
  });
});
