import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTerms } from "@/agents/terms";

/**
 * Golden eval for the A2 Terms agent — scores real T&C parsing against
 * evals/tnc-golden.json. Requires a live Bedrock model, so it SKIPS until
 * Bedrock is configured (AWS creds + BEDROCK_MODEL_ID). Once the Anthropic
 * use-case form clears and creds are in .env, this runs the real scoring:
 *   npm test   (or: npx vitest run evals)
 */

interface GoldenCase {
  id: string;
  termsRaw: string;
  expect: Record<string, number | string | boolean>;
  minConfidence: number;
}

const golden: { cases: GoldenCase[] } = JSON.parse(
  readFileSync(resolve(process.cwd(), "evals/tnc-golden.json"), "utf8"),
);

function bedrockReady(): boolean {
  const hasAuth =
    !!process.env.AWS_BEARER_TOKEN_BEDROCK ||
    (!!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY);
  return hasAuth && !!process.env.BEDROCK_MODEL_ID;
}

describe.skipIf(!bedrockReady())("A2 Terms agent — golden eval (live Bedrock)", () => {
  for (const c of golden.cases) {
    it(
      `${c.id}: extracts the expected rules and grounds every number`,
      async () => {
        // parseTerms() runs the model AND asserts grounding; a throw fails the case.
        const parsed = await parseTerms(c.termsRaw);
        expect(parsed.parseConfidence).toBeGreaterThanOrEqual(c.minConfidence);

        const byPredicate = new Map<string, number | string | string[]>(
          parsed.rules.map((r) => [r.predicate as string, r.value]),
        );
        for (const [predicate, expected] of Object.entries(c.expect)) {
          if (typeof expected === "number") {
            // numeric predicates must match the exact value
            expect(Number(byPredicate.get(predicate))).toBe(expected);
          } else if (expected === true) {
            // boolean constraints (one_time_use, not_combinable_group) must be present
            expect(byPredicate.has(predicate)).toBe(true);
          } else if (typeof expected === "string") {
            // merchant/category: loose presence + value contains the expected token
            const value = byPredicate.get(predicate);
            const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
            expect(text.toLowerCase()).toContain(expected.toLowerCase());
          }
        }
      },
      30_000,
    );
  }
});
