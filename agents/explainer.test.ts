import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { explainPlan } from "./explainer";
import type { Plan } from "@/lib/types";

describe("explainPlan", () => {
  const mock = (text: string) =>
    new MockLanguageModelV4({
      // generateText just needs the text content back; cast bridges the SDK's
      // internal result type in test code.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doGenerate: async () =>
        ({
          content: [{ type: "text", text }],
          finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    });

  it("returns the generated explanation text for a plan", async () => {
    const plan: Plan = {
      name: "Cheapest after rewards",
      offer: {
        id: "o1",
        title: "Sony WH-1000XM5",
        priceUsd: 348,
        retailer: "bestbuy.com",
        buyUrl: "https://bestbuy.com/x",
      },
      useRewards: [{ rewardId: "r1", appliedUsd: 30 }],
      savedUsd: 30,
      cashUsd: 318,
    };
    const explanation =
      "You save $30 on the Sony WH-1000XM5 from bestbuy.com, paying just $318.";

    const out = await explainPlan(plan, mock(explanation));

    expect(out).toBe(explanation);
  });
});
