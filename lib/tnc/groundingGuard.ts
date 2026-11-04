import type { ParsedTerms } from "@/lib/tnc/schema";

/**
 * groundingGuard — every number in a parsed rule MUST appear verbatim in the
 * source T&Cs text. If the LLM invented a number, we reject the rule.
 *
 * This is the guard that keeps the LLM from "computing money". DETERMINISTIC.
 * OWNER: Rachandeep Kaur.
 */
export function assertGrounded(_parsed: ParsedTerms, _sourceText: string): void {
  // TODO(rachan): extract numeric tokens from each rule value + quotedClause;
  // assert each appears in sourceText; throw with the offending number if not.
  throw new Error("assertGrounded() not implemented");
}
