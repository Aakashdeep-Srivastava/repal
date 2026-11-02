/**
 * fx — pinned INR/USD for cross-border display only.
 *
 * PayPal settles in USD (INR is not a PayPal REST currency). We only ever
 * DISPLAY ₹ with a pinned rate and an honest note. Never used to compute the
 * money PayPal actually moves. See docs/TECH_PRD.md §4.
 */
export const FX_INR_PER_USD = Number(process.env.FX_INR_PER_USD ?? 84);

/** Convert a USD amount to INR for display. Rounds to 2 dp. */
export function usdToInrDisplay(usd: number, rate: number = FX_INR_PER_USD): number {
  return Math.round(usd * rate * 100) / 100;
}
