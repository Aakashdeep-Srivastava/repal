import { ParsedTermsSchema, type ParsedTerms } from "@/lib/tnc/schema";

/**
 * groundingGuard — every number in a parsed rule MUST appear verbatim in the
 * source T&Cs text. If the LLM invented a number, we reject the rule.
 *
 * This is the guard that keeps the LLM from "computing money". DETERMINISTIC.
 * OWNER: Rachandeep Kaur.
 *
 * For each rule:
 *  1. `quotedClause` must appear in the source (case- and whitespace-insensitive).
 *  2. Every number in the rule's value must appear as a number INSIDE that
 *     quoted clause ("$1,000" → 1000, "5%" → 5, "$100+" → 100). Clause ⊂ source,
 *     so the number is in the source too — and it is tied to the clause cited.
 *     Percentages are whole percents (5% → 5, never 0.05).
 *  3. `expires_on` must be a YYYY-MM-DD date that is written in the quoted
 *     clause ("Dec 31, 2026", "31 December 2026", "2026-12-31", "12/31/2026").
 *     Relative dates ("in 7 days") cannot be grounded and are rejected.
 * The whole parse is rejected (throws GroundingError) on the first violation,
 * after first validating it against ParsedTermsSchema.
 */
export class GroundingError extends Error {
  constructor(
    message: string,
    readonly ruleIndex: number,
    readonly offending: string,
  ) {
    super(message);
    this.name = "GroundingError";
  }
}

const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** All numbers written in the text, thousands separators removed. */
export function numbersIn(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((t) => Number(t.replace(/,/g, "")))
    .filter(Number.isFinite);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

function isoDate(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/** All calendar dates written in the text, as YYYY-MM-DD. */
export function datesIn(text: string): string[] {
  const out: (string | null)[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(isoDate(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi")))
    out.push(isoDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]));
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE},?\\s+(\\d{4})\\b`, "gi")))
    out.push(isoDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]));
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) out.push(isoDate(+m[3], +m[1], +m[2])); // US M/D/Y
  return out.filter((d): d is string => d !== null);
}

export function assertGrounded(parsed: ParsedTerms, sourceText: string): void {
  const terms = ParsedTermsSchema.parse(parsed);
  const source = norm(sourceText);

  terms.rules.forEach((rule, i) => {
    const clause = norm(rule.quotedClause);
    if (!source.includes(clause)) {
      throw new GroundingError(
        `Rule ${i} (${rule.predicate}): quoted clause not found in source: "${rule.quotedClause}"`,
        i,
        rule.quotedClause,
      );
    }
    const clauseNumbers = numbersIn(clause);
    const requireNumber = (n: number) => {
      if (!clauseNumbers.includes(n)) {
        throw new GroundingError(
          `Rule ${i} (${rule.predicate}): number ${n} does not appear in its quoted clause "${rule.quotedClause}"`,
          i,
          String(n),
        );
      }
    };

    if (rule.predicate === "expires_on") {
      const v = String(rule.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !datesIn(clause).includes(v)) {
        throw new GroundingError(
          `Rule ${i} (expires_on): date ${v} is not written in its quoted clause "${rule.quotedClause}"`,
          i,
          v,
        );
      }
      return;
    }

    if (typeof rule.value === "number") {
      requireNumber(rule.value);
    } else {
      for (const s of Array.isArray(rule.value) ? rule.value : [rule.value]) {
        numbersIn(s).forEach(requireNumber);
      }
    }
  });
}
