/**
 * Money helpers — all optimizer/policy arithmetic is done in integer cents so
 * float drift (0.1 + 0.2) can never change a decision. DETERMINISTIC.
 * OWNER: Rachandeep Kaur.
 */

/** USD (number) → integer cents, rounding half away from zero. */
export function toCents(usd: number): number {
  if (!Number.isFinite(usd)) throw new Error(`toCents: non-finite amount ${usd}`);
  return Math.sign(usd) * Math.round(Math.abs(usd) * 100);
}

/** Integer cents → USD number with exactly 2-decimal precision. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** "$1,234.50" — for human-readable rejection / policy reasons. */
export function fmtUsd(usd: number): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
