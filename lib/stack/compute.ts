// lib/stack/compute.ts
// Deterministic wallet stacking -> ONE PayPal payment. No LLM. All math in integer cents.
//
// Every wallet reward is checked clause-by-clause against THIS purchase
// (store, category, expiry, minimum spend). Rules come from the Terms agent's parse
// of the reward's T&Cs; this file only evaluates them.
//
// Application order (how retailers and PayPal apply them):
//   1. % off coupons → 2. $ off coupons            (discounts on the price)
//   3. certificates / gift cards / card rewards     (tender: pays part of the bill, NOT a coupon)
//   ── PayPal captures the remainder: ONE payment ──
//   4. cash back % / statement credits              (after payment)
//
// Coupon exclusivity: if an eligible coupon says "cannot be combined with other coupons",
// keep the single most valuable coupon. Tender still stacks with it.

export type StackType =
  | "pct_off" | "amount_off"                        // coupons / saved offers
  | "certificate" | "gift_card" | "card_rewards"    // tender
  | "cashback_pct" | "statement_credit";            // after payment

export interface Stackable {
  id: string;
  label: string;              // "Best Buy 10% off audio"
  kind: string;               // wallet chip subtitle: "Saved offer", "Certificate", "Gift card", …
  domain: string;             // logo
  merchantName?: string;
  type: StackType;
  value: number;              // % for *_pct / pct_off, USD otherwise
  maxUsd?: number;
  minSpendUsd?: number;
  onlyAt?: string[];          // usable only at these domains
  onlyCategories?: string[];  // usable only on these categories
  expiresInDays?: number;     // negative = already expired
  exclusiveCoupon?: boolean;  // "cannot be combined with other coupons"
  clause: string;             // quoted T&C
  source?: string;            // where it came from: Gmail, PayPal, Amex…
}

export interface PurchaseContext { domain: string; category: string }
export interface Check { label: string; pass: boolean }
export type When = "checkout" | "after_payment";

export interface StackStep {
  item: Stackable;
  when: When;
  amountCents: number;
  runningCents: number;       // amount due after this step
  checks: Check[];            // the T&C clauses this reward passed
}
export interface Rejected { item: Stackable; reason: string; checks: Check[] }

export interface StackResult {
  priceCents: number;
  steps: StackStep[];
  rejected: Rejected[];
  payNowCents: number;        // the ONE PayPal capture
  backLaterCents: number;
  effectiveCents: number;
  savedCents: number;
}

const c = (usd: number) => Math.round(usd * 100);
export const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const isCoupon = (t: StackType) => t === "pct_off" || t === "amount_off";
const isTender = (t: StackType) => t === "certificate" || t === "gift_card" || t === "card_rewards";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Evaluate each T&C clause for this purchase. Order = order shown to the user. */
export function checkTerms(s: Stackable, priceCents: number, ctx?: PurchaseContext): Check[] {
  const out: Check[] = [];
  if (s.expiresInDays != null)
    out.push(s.expiresInDays < 0
      ? { label: `Expired ${-s.expiresInDays} day${s.expiresInDays === -1 ? "" : "s"} ago`, pass: false }
      : { label: s.expiresInDays <= 7 ? `Expires in ${s.expiresInDays}d` : "Not expired", pass: true });
  if (ctx && s.onlyAt) {
    const ok = s.onlyAt.includes(ctx.domain);
    out.push({ label: ok ? `Valid at ${s.merchantName ?? ctx.domain}` : `Only valid at ${s.merchantName ?? s.onlyAt[0]}`, pass: ok });
  }
  if (ctx && s.onlyCategories) {
    const ok = s.onlyCategories.includes(ctx.category);
    out.push({ label: ok ? `${cap(ctx.category)} eligible` : `${cap(s.onlyCategories.join(", "))} only, not ${ctx.category}`, pass: ok });
  }
  if (s.minSpendUsd != null) {
    const ok = priceCents >= c(s.minSpendUsd);
    out.push({ label: ok ? `$${s.minSpendUsd}+ spend met` : `Needs $${s.minSpendUsd}+ (order is ${fmt(priceCents)})`, pass: ok });
  }
  if (s.maxUsd != null) out.push({ label: `Up to $${s.maxUsd}`, pass: true });
  return out;
}

function couponValue(s: Stackable, baseCents: number) {
  const raw = s.type === "pct_off" ? Math.round((baseCents * s.value) / 100) : c(s.value);
  return Math.min(raw, s.maxUsd != null ? c(s.maxUsd) : raw, baseCents);
}

export function computeStack(priceUsd: number, wallet: Stackable[], ctx?: PurchaseContext): StackResult {
  const priceCents = c(priceUsd);
  const rejected: Rejected[] = [];
  const steps: StackStep[] = [];
  const checksOf = new Map<string, Check[]>();

  // ── 0. T&C eligibility for this purchase ──
  const items = wallet.filter((i) => {
    const checks = checkTerms(i, priceCents, ctx);
    checksOf.set(i.id, checks);
    const fail = checks.find((x) => !x.pass);
    if (fail) { rejected.push({ item: i, reason: fail.label, checks }); return false; }
    return true;
  });

  // ── exclusivity among eligible coupons ──
  let coupons = items.filter((i) => isCoupon(i.type));
  if (coupons.length > 1 && coupons.some((x) => x.exclusiveCoupon)) {
    const best = [...coupons].sort((a, b) => couponValue(b, priceCents) - couponValue(a, priceCents))[0];
    for (const x of coupons) if (x !== best)
      rejected.push({ item: x, reason: `Can't combine with ${best.label}`, checks: checksOf.get(x.id)! });
    coupons = [best];
  }

  // ── 1+2. coupons: % first, then $ ──
  let due = priceCents;
  for (const s of [...coupons].sort((a, b) => (a.type === "pct_off" ? 0 : 1) - (b.type === "pct_off" ? 0 : 1))) {
    const amt = couponValue(s, due);
    due -= amt;
    steps.push({ item: s, when: "checkout", amountCents: amt, runningCents: due, checks: checksOf.get(s.id)! });
  }
  const subtotal = due;

  // ── 3. tender: soonest-expiring first, so nothing that's about to lapse is left unused ──
  const tender = items.filter((i) => isTender(i.type))
    .sort((a, b) => (a.expiresInDays ?? 9999) - (b.expiresInDays ?? 9999));
  for (const s of tender) {
    if (due === 0) { rejected.push({ item: s, reason: "Order already fully covered", checks: checksOf.get(s.id)! }); continue; }
    const amt = Math.min(c(s.value), due);
    due -= amt;
    steps.push({ item: s, when: "checkout", amountCents: amt, runningCents: due, checks: checksOf.get(s.id)! });
  }
  const payNowCents = due;

  // ── 4. after payment ──
  for (const s of items.filter((i) => i.type === "cashback_pct" || i.type === "statement_credit")) {
    let amt = s.type === "cashback_pct" ? Math.round((subtotal * s.value) / 100) : c(s.value);
    if (s.maxUsd != null) amt = Math.min(amt, c(s.maxUsd));
    steps.push({ item: s, when: "after_payment", amountCents: amt, runningCents: payNowCents, checks: checksOf.get(s.id)! });
  }

  const backLaterCents = steps.filter((s) => s.when === "after_payment").reduce((a, s) => a + s.amountCents, 0);
  return {
    priceCents, steps, rejected, payNowCents, backLaterCents,
    effectiveCents: payNowCents - backLaterCents,
    savedCents: priceCents - (payNowCents - backLaterCents),
  };
}
