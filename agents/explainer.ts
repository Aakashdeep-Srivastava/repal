import { generateText, type LanguageModel } from "ai";
import { claude } from "@/lib/ai/bedrock";
import type { Plan } from "@/lib/types";

/**
 * A5 Explainer agent — a deterministic `Plan` → one friendly sentence or two.
 *
 * LLM (free text) via `generateText` on the Bedrock Claude model. This step is
 * pure narration: it restates numbers the optimizer already computed and placed
 * on the plan (cashUsd, savedUsd, offer.title, offer.retailer). It NEVER does
 * arithmetic and never introduces a figure not already present in the plan.
 *
 * OWNER: Aakash.
 */

const SYSTEM = [
  "You explain a shopping plan to the shopper in 1-2 warm, friendly sentences.",
  "State ONLY numbers already present in the plan JSON: cashUsd, savedUsd, and",
  "the offer's title and retailer. Do NOT compute, estimate, or invent any",
  "number — you are narrating a result that was already decided for you.",
  "Keep it concise and reassuring; no bullet points, no preamble.",
].join(" ");

/**
 * Produce a short, human-friendly explanation of why `plan` is a good choice.
 * The plan is passed as JSON so the model narrates its exact, deterministic
 * numbers without recomputing anything.
 */
export async function explainPlan(
  plan: Plan,
  model: LanguageModel = claude,
): Promise<string> {
  const { text } = await generateText({
    model,
    temperature: 0,
    system: SYSTEM,
    prompt: `Explain why this plan is good for the shopper:\n\n${JSON.stringify(plan)}`,
  });
  return text;
}
