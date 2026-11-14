/**
 * Agent-selected funding — the deterministic "which PayPal funding method should
 * the agent use?" brain. See docs/TECH_PRD.md §4 (Orders v2).
 *
 * This is the agentic-commerce centerpiece: the agent doesn't just pay, it
 * *chooses how* to pay the stacked lowest price — instant PayPal balance, Venmo,
 * or Pay Later (split, interest-free) — the way a thoughtful human would. The
 * choice is DETERMINISTIC and explainable (never an LLM guess): it's a pure
 * function of the amount, so the UI can show the reasoning and the user can
 * override. The chosen source is handed to Orders v2 as the `payment_source`.
 *
 * OWNER: Aakash.
 */

/**
 * The funding methods the agent can route a checkout through. These map to
 * Orders v2 `payment_source` keys:
 *   - `venmo`     → a dedicated `payment_source.venmo` (distinct wallet).
 *   - `paypal`    → `payment_source.paypal` (balance / linked card / bank).
 *   - `pay_later` → `payment_source.paypal`; the approval page presents the
 *                   Pay-in-4 / Pay Later option when the buyer is eligible.
 */
export type FundingSource = "paypal" | "pay_later" | "venmo";

export interface FundingOption {
  source: FundingSource;
  /** Display name, e.g. "Pay Later". */
  label: string;
  /** One-line agent rationale (why this fits). */
  tagline: string;
  /** Short brand-flavoured descriptor shown under the label. */
  detail: string;
  emoji: string;
}

export interface FundingChoice {
  /** The method the agent recommends for this amount. */
  chosen: FundingOption;
  /** Other viable methods, ranked — offered as one-tap overrides. */
  alternatives: FundingOption[];
  /** Plain-language reason the agent picked `chosen` (amount-aware). */
  reason: string;
}

/** Thresholds that shape the agent's funding decision (USD). */
const PAY_LATER_MIN = 100; // big-ticket → worth splitting, interest-free.
const VENMO_MAX = 30; // small / social → fast Venmo tap.

/** Static descriptors for each funding method (brand-honest, no fabricated terms). */
const OPTIONS: Record<FundingSource, Omit<FundingOption, "tagline">> = {
  paypal: {
    source: "paypal",
    label: "PayPal balance",
    detail: "Instant — from your PayPal balance, card, or bank",
    emoji: "⚡",
  },
  pay_later: {
    source: "pay_later",
    label: "Pay Later",
    detail: "Split into 4 interest-free payments (if eligible)",
    emoji: "🗓️",
  },
  venmo: {
    source: "venmo",
    label: "Venmo",
    detail: "Fast checkout from your Venmo balance",
    emoji: "💸",
  },
};

function opt(source: FundingSource, tagline: string): FundingOption {
  return { ...OPTIONS[source], tagline };
}

/**
 * Pick the best funding method for an amount, with ranked alternatives and a
 * human-readable reason. Pure + deterministic → unit-testable and explainable.
 */
export function selectFunding(amountUsd: number): FundingChoice {
  const amt = Number.isFinite(amountUsd) ? Math.max(0, amountUsd) : 0;

  if (amt >= PAY_LATER_MIN) {
    const perInstalment = amt / 4;
    return {
      chosen: opt(
        "pay_later",
        `Spread $${amt.toFixed(2)} over 4 interest-free payments of ~$${perInstalment.toFixed(2)}`,
      ),
      alternatives: [
        opt("paypal", "Or pay it all now from your balance"),
        opt("venmo", "Or tap to pay with Venmo"),
      ],
      reason: `This is a $${amt.toFixed(
        2,
      )} purchase — big enough that splitting it into 4 interest-free payments keeps your cash free, so I recommend Pay Later.`,
    };
  }

  if (amt <= VENMO_MAX && amt > 0) {
    return {
      chosen: opt("venmo", "Small enough for a fast one-tap Venmo checkout"),
      alternatives: [
        opt("paypal", "Or pay instantly from your PayPal balance"),
        opt("pay_later", "Pay Later isn't worth it for a small amount"),
      ],
      reason: `At $${amt.toFixed(
        2,
      )} this is a small, everyday purchase — Venmo is the quickest tap, so I'll use that.`,
    };
  }

  return {
    chosen: opt("paypal", "Pay instantly — your rewards already cut the price"),
    alternatives: [
      opt("pay_later", "Or split it into 4 with Pay Later"),
      opt("venmo", "Or pay with Venmo"),
    ],
    reason: `Your rewards already brought this down to $${amt.toFixed(
      2,
    )} — small enough to just settle instantly from your PayPal balance.`,
  };
}

/** Narrow an untrusted string to a FundingSource (for request validation). */
export function isFundingSource(v: unknown): v is FundingSource {
  return v === "paypal" || v === "pay_later" || v === "venmo";
}
