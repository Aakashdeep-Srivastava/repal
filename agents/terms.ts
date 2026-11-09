import { generateText, Output, type LanguageModel } from "ai";
import { claude } from "@/lib/ai/bedrock";
import { ParsedTermsSchema, type ParsedTerms } from "@/lib/tnc/schema";
import { assertGrounded } from "@/lib/tnc/groundingGuard";

/**
 * A2 Terms agent — a reward's free-text T&Cs → typed, grounded `ParsedTerms`.
 *
 * LLM (structured) via `generateText` + `Output.object` on the Bedrock Claude
 * model. The model
 * may only emit rules drawn from the fixed predicate vocabulary, each carrying
 * a verbatim `quotedClause`. It never computes or invents a number — it only
 * extracts. After generation, `assertGrounded` deterministically rejects any
 * number that does not appear verbatim in the source text, so a hallucinated
 * figure can never slip through.
 *
 * OWNER: Aakash (agent) + Rachandeep Kaur (schema + grounding guard).
 */

const SYSTEM = [
  "You convert a reward's free-text Terms & Conditions into typed rules.",
  "Use ONLY this predicate vocabulary: min_spend_usd, max_discount_usd,",
  "percent_off, flat_off_usd, category_allow, category_deny, merchant_allow,",
  "merchant_deny, expires_on, not_combinable_group, one_time_use.",
  "Every rule MUST include a quotedClause copied EXACTLY (verbatim) from the",
  "source text — do not paraphrase, reword, or reformat the clause.",
  "NEVER invent a number: every value must come straight from the source.",
  "If a detail is not stated, omit the rule rather than guessing.",
  "Set parseConfidence between 0 and 1 to reflect how cleanly the text parsed.",
].join(" ");

/**
 * Parse a reward's raw T&Cs into typed, grounded rules. Throws (via
 * `assertGrounded`) if the model emitted any number absent from `termsRaw`.
 */
export async function parseTerms(
  termsRaw: string,
  model: LanguageModel = claude,
): Promise<ParsedTerms> {
  const { output } = await generateText({
    model,
    temperature: 0,
    system: SYSTEM,
    prompt: termsRaw,
    output: Output.object({ schema: ParsedTermsSchema }),
  });
  assertGrounded(output, termsRaw);
  return output;
}
