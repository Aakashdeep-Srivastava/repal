import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { intentSchema, renderIntent } from "./intent";

describe("intentSchema", () => {
  it("accepts a full intent", () => {
    const r = intentSchema.safeParse({
      category: "headphones",
      maxPriceUsd: 250,
      merchantPreferences: ["bestbuy.com"],
      mustHave: ["noise cancelling"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts category-only (optionals omitted)", () => {
    const r = intentSchema.safeParse({ category: "laptop stand" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.maxPriceUsd).toBeUndefined();
      expect(r.data.merchantPreferences).toBeUndefined();
    }
  });

  it("rejects a non-positive budget", () => {
    expect(intentSchema.safeParse({ category: "x", maxPriceUsd: 0 }).success).toBe(false);
    expect(intentSchema.safeParse({ category: "x", maxPriceUsd: -5 }).success).toBe(false);
  });

  it("requires a category", () => {
    expect(intentSchema.safeParse({ maxPriceUsd: 100 }).success).toBe(false);
  });
});

describe("renderIntent", () => {
  const mock = (obj: unknown) =>
    new MockLanguageModelV4({
      // Mock only needs to feed JSON back to generateObject; cast bridges the
      // SDK's internal result type in test code.
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

  it("echoes rawText and merges the model-extracted fields", async () => {
    const raw = "noise cancelling headphones under $250 from Best Buy";
    const intent = await renderIntent(
      raw,
      mock({ category: "headphones", maxPriceUsd: 250, merchantPreferences: ["bestbuy.com"] }),
    );
    expect(intent.rawText).toBe(raw);
    expect(intent.category).toBe("headphones");
    expect(intent.maxPriceUsd).toBe(250);
    expect(intent.merchantPreferences).toEqual(["bestbuy.com"]);
  });

  it("works with only a category (no invented budget)", async () => {
    const intent = await renderIntent("I need a laptop stand", mock({ category: "laptop stand" }));
    expect(intent.category).toBe("laptop stand");
    expect(intent.maxPriceUsd).toBeUndefined();
  });
});
