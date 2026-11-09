import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { claude } from "@/lib/ai/bedrock";
import type { PurchaseIntent } from "@/lib/types";

/**
 * A1 Intent agent — plain-language request → structured `PurchaseIntent`.
 *
 * LLM (structured) via `generateText` + `Output.object` on the Bedrock Claude
 * model. The schema
 * mirrors the `PurchaseIntent` contract (lib/types.ts). This is a pure read/
 * extract step — it never computes money, never invents a budget or merchant.
 * OWNER: Aakash.
 */

/** Zod shape of the extracted fields (everything except the echoed rawText). */
export const intentSchema = z.object({
  category: z
    .string()
    .describe('Product category the user wants, e.g. "headphones", "laptop stand".'),
  maxPriceUsd: z
    .number()
    .positive()
    .optional()
    .describe("Maximum price in USD — only if the user stated a budget/ceiling."),
  merchantPreferences: z
    .array(z.string())
    .optional()
    .describe("Preferred retailers/merchants, only if the user named any."),
  mustHave: z
    .array(z.string())
    .optional()
    .describe("Required features/attributes the user insisted on."),
});

export type IntentFields = z.infer<typeof intentSchema>;

const SYSTEM = [
  "You turn a shopper's plain-language request into a structured purchase intent.",
  "Extract ONLY what the user actually said. Never invent a budget, merchant, or",
  "requirement. Omit any optional field you are not sure about — an absent field",
  "is better than a guessed one. Do not do any math or pricing.",
].join(" ");

/**
 * Parse a raw shopper request into a typed intent. The returned object echoes
 * `rawText` alongside the model-extracted fields, satisfying `PurchaseIntent`.
 */
export async function renderIntent(
  rawText: string,
  model: LanguageModel = claude,
): Promise<PurchaseIntent> {
  const { output } = await generateText({
    model,
    temperature: 0,
    system: SYSTEM,
    prompt: rawText,
    output: Output.object({ schema: intentSchema }),
  });
  return { rawText, ...output };
}
