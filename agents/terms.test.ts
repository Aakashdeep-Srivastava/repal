import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { parseTerms } from "./terms";

// Uses the real grounding guard (lib/tnc/groundingGuard.ts). The happy-path
// rules below are genuinely grounded in termsRaw, so assertGrounded passes; the
// ungrounded case trips it.
const mock = (obj: unknown) =>
  new MockLanguageModelV4({
    // Feed JSON straight back to generateObject; cast bridges the SDK's
    // internal result type in test code.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doGenerate: async () =>
      ({
        content: [{ type: "text", text: JSON.stringify(obj) }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
  });

describe("parseTerms", () => {
  const termsRaw = "Flat $30 off headphones over $200. One redemption per cardholder.";

  it("returns typed rules and parseConfidence from grounded T&Cs", async () => {
    const rules = [
      { predicate: "flat_off_usd", value: 30, quotedClause: "Flat $30 off headphones over $200" },
      { predicate: "min_spend_usd", value: 200, quotedClause: "over $200" },
      { predicate: "one_time_use", value: "true", quotedClause: "One redemption per cardholder" },
    ];
    const parsed = await parseTerms(termsRaw, mock({ rules, parseConfidence: 0.9 }));
    expect(parsed.parseConfidence).toBe(0.9);
    expect(parsed.rules).toEqual(rules);
  });

  it("throws when the model returns an ungrounded number", async () => {
    const rules = [
      // Clause is a real substring, but $999 never appears in the source.
      { predicate: "flat_off_usd", value: 999, quotedClause: "Flat $30 off headphones over $200" },
    ];
    await expect(parseTerms(termsRaw, mock({ rules, parseConfidence: 0.9 }))).rejects.toThrow(
      /ungrounded number/i,
    );
  });

  it("throws when the model returns an ungrounded clause", async () => {
    const rules = [
      { predicate: "flat_off_usd", value: 30, quotedClause: "Buy one get one free" },
    ];
    await expect(parseTerms(termsRaw, mock({ rules, parseConfidence: 0.9 }))).rejects.toThrow(
      /ungrounded clause/i,
    );
  });
});
