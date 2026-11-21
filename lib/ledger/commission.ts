/**
 * Commercial-commission math — PURE and DETERMINISTIC (no DB, no LLM).
 *
 * All amounts are integer CENTS; all rates are basis points (1 bp = 0.01%), so
 * the arithmetic is exact — the same discipline as lib/optimizer/money.ts.
 *
 * The commercial model (spec §6): RePal earns a fee on the value it drives (the
 * net amount PayPal actually settled — the attributed GMV), and a publisher that
 * distributed the offer earns a contractual share carved OUT of RePal's fee.
 * PayPal never sees any of this; it only moves the shopper's payment. This ledger
 * accounts for the commission.
 *
 * OWNER: commercial ledger.
 */

/** Demo default when no PartnerAgreement governs a redemption: RePal takes 5%. */
export const DEFAULT_REPAL_FEE_BPS = 500;

const BPS_DENOMINATOR = 10_000;

export interface CommissionSplit {
  /** Base the fee was computed on (the settled/attributed GMV, in cents). */
  baseCents: number;
  /** RePal's gross commission on the base. */
  repalFeeCents: number;
  /** The publisher's share, carved out of RePal's fee (0 when no publisher). */
  publisherCents: number;
  /** What RePal keeps after the publisher's share. */
  repalNetCents: number;
}

/** floor(valueCents * bps / 10000) — integer-exact, never negative. */
function applyBps(valueCents: number, bps: number): number {
  if (!Number.isInteger(valueCents)) throw new Error(`applyBps: non-integer cents ${valueCents}`);
  if (valueCents < 0 || bps < 0) throw new Error(`applyBps: negative input (${valueCents}, ${bps})`);
  return Math.floor((valueCents * bps) / BPS_DENOMINATOR);
}

/**
 * Split the commission on a redemption. `baseCents` is the attributed GMV (the
 * net amount PayPal settled). RePal's fee is `repalFeeBps` of the base; the
 * publisher's cut is `revShareBps` OF that fee (not of the base), so RePal can
 * never owe a publisher more than it earned.
 */
export function computeCommission(
  baseCents: number,
  repalFeeBps: number,
  revShareBps: number,
): CommissionSplit {
  const repalFeeCents = applyBps(baseCents, repalFeeBps);
  const publisherCents = applyBps(repalFeeCents, revShareBps);
  return {
    baseCents,
    repalFeeCents,
    publisherCents,
    repalNetCents: repalFeeCents - publisherCents,
  };
}

/**
 * Cashback accrual for a redeemed cashback offer, in cents. `cashback_pct`
 * accrues `value`% of the spend (the settled base); `amount_off`/`welcome_cash`
 * style fixed rewards are passed through as a flat value. Capped by
 * `maxRewardCents` when set, and never exceeds the base. Returns 0 for offer
 * types that carry no customer cashback (e.g. plain `pct_off` discounts).
 */
export function computeCashbackCents(
  offerType: string,
  value: number,
  baseCents: number,
  maxRewardCents?: number | null,
): number {
  let raw: number;
  switch (offerType) {
    case "cashback_pct":
      raw = applyBps(baseCents, Math.round(value * 100)); // value% → bps
      break;
    case "welcome_cash":
    case "statement_credit":
      raw = Math.round(value * 100); // flat USD → cents
      break;
    default:
      return 0; // pct_off / amount_off / free_shipping reduce the price, not cashback
  }
  const capped = maxRewardCents != null ? Math.min(raw, maxRewardCents) : raw;
  return Math.max(0, Math.min(capped, baseCents));
}
