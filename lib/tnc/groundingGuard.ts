import type { ParsedTerms } from "@/lib/tnc/schema";

/**
 * groundingGuard — every number in a parsed rule MUST appear verbatim in the
 * source T&Cs text, and every rule's quotedClause MUST be a real substring of
 * that source. If the LLM invented a number or a clause, we reject it.
 *
 * This is the guard that keeps the LLM from "computing money". DETERMINISTIC.
 * OWNER: Rachandeep Kaur.
 */

/** Collapse runs of whitespace to a single space and trim. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Matches a number token, tolerant of thousands separators and decimals.
 * e.g. "50", "50.00", "1,000", "1,000.50". Currency symbols / percent signs
 * sit OUTSIDE the match, so "$50" and "50%" both yield the token "50".
 */
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;

/** Parse a raw number token ("1,000.50") into a JS number (1000.5). */
function parseToken(token: string): number {
  return parseFloat(token.replace(/,/g, ""));
}

/** Every numeric value that appears anywhere in `text`. */
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    const n = parseToken(m[0]);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

/**
 * The numbers that a rule's `value` asserts and that therefore MUST be grounded
 * in the source. Numbers that live only inside the quotedClause (but not in the
 * value) are NOT required here — the clause substring check already covers them.
 *
 * Design choice for date-shaped predicates (expires_on): we do NOT decompose a
 * date string like "2027-01-31" into separate grounded numbers (2027, 1, 31).
 * Requiring each date component as an independent number token would be both
 * noisy and wrong (e.g. "01" vs "1"); the date's grounding is instead covered
 * by the quotedClause substring check. So for expires_on we skip number
 * extraction entirely.
 */
function requiredNumbers(predicate: string, value: number | string | string[]): number[] {
  if (predicate === "expires_on") return [];

  if (typeof value === "number") return [value];
  if (typeof value === "string") return extractNumbers(value);
  // string[] — extract numbers embedded in each element.
  return value.flatMap((v) => extractNumbers(v));
}

/**
 * Asserts that `parsed` is fully grounded in `sourceText`:
 *  1. each rule.quotedClause appears as a substring of the source (whitespace-
 *     normalized, case-insensitive);
 *  2. every number asserted by rule.value appears as a number token in the
 *     source (currency symbols / commas / percent signs tolerated, compared
 *     numerically so 50, 50.0 and "$50.00" all match).
 *
 * Throws Error on the first violation; returns void when all rules pass.
 */
export function assertGrounded(parsed: ParsedTerms, sourceText: string): void {
  const normSource = normalizeWhitespace(sourceText).toLowerCase();
  const sourceNumbers = extractNumbers(sourceText);

  for (const rule of parsed.rules) {
    // 1) quotedClause grounding.
    const normClause = normalizeWhitespace(rule.quotedClause).toLowerCase();
    if (!normSource.includes(normClause)) {
      throw new Error(`ungrounded clause: "${rule.quotedClause}"`);
    }

    // 2) number grounding.
    for (const n of requiredNumbers(rule.predicate, rule.value)) {
      if (!sourceNumbers.some((candidate) => candidate === n)) {
        throw new Error(`ungrounded number: ${n}`);
      }
    }
  }
}
