import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ParsedTermsSchema, type ParsedTerms } from "@/lib/tnc/schema";
import { assertGrounded } from "@/lib/tnc/groundingGuard";

/**
 * Validates the golden T&C fixtures themselves: every expected parse is
 * schema-valid and passes the grounding guard against its own source text.
 * When the Terms agent (A2) lands, its output is scored against these.
 * OWNER: Rachandeep Kaur.
 */
interface GoldenCase {
  id: string;
  termsRaw: string;
  expected: ParsedTerms;
}

const golden = JSON.parse(readFileSync(resolve(__dirname, "tnc-golden.json"), "utf8")) as {
  cases: GoldenCase[];
};

describe("tnc golden eval fixtures", () => {
  it("has 20 cases with unique ids", () => {
    expect(golden.cases).toHaveLength(20);
    expect(new Set(golden.cases.map((c) => c.id)).size).toBe(20);
  });

  it.each(golden.cases.map((c) => [c.id, c] as const))("%s is schema-valid and grounded", (_id, c) => {
    expect(() => ParsedTermsSchema.parse(c.expected)).not.toThrow();
    expect(() => assertGrounded(c.expected, c.termsRaw)).not.toThrow();
  });
});
