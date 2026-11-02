import { z } from "zod";

/**
 * Predicate vocabulary for parsed reward T&Cs.
 *
 * The Terms agent (A2) must emit rules using ONLY these predicates, each with
 * a verbatim quoted clause. The grounding guard (./groundingGuard.ts) then
 * verifies every number appears in the source text. OWNER: Rachandeep Kaur.
 */
export const PredicateEnum = z.enum([
  "min_spend_usd",
  "max_discount_usd",
  "percent_off",
  "flat_off_usd",
  "category_allow",
  "category_deny",
  "merchant_allow",
  "merchant_deny",
  "expires_on",
  "not_combinable_group",
  "one_time_use",
]);

export const RewardRuleSchema = z.object({
  predicate: PredicateEnum,
  value: z.union([z.number(), z.string(), z.array(z.string())]),
  quotedClause: z.string().min(1),
});

export const ParsedTermsSchema = z.object({
  rules: z.array(RewardRuleSchema),
  parseConfidence: z.number().min(0).max(1),
});

export type ParsedTerms = z.infer<typeof ParsedTermsSchema>;
