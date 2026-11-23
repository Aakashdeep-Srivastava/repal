import type { WalletReward } from "@/lib/schemas";

/**
 * Rescue logic — pure, deterministic helpers for the rewards-recovery dashboard.
 *
 * Everything the /rescue page shows (value at risk, expiring counts, urgency,
 * per-reward action) is derived here from the REAL wallet payload, never
 * fabricated. No money is computed — `valueUsd` passes through verbatim; we only
 * bucket by expiry and sum values that already exist. Taking `now` as a parameter
 * keeps these unit-testable and keeps the components free of date-branching.
 *
 * Honesty rules encoded here:
 *  - "Value at risk" sums only rewards that carry a real cash `valueUsd`; rate
 *    rewards (e.g. "5% back", `valueUsd: 0`) are deliberately excluded because
 *    their worth depends on what you buy — counting them would invent money.
 *  - Only cash-like rewards are labelled cashable; coupons/percent rewards get a
 *    "use it on a purchase" action instead of a misleading "cash out".
 */

const DAY = 86_400_000;

export type Urgency = "expired" | "critical" | "soon" | "later";

/** Whole days until expiry (negative once expired). NaN-safe → treated as far future. */
export function daysLeft(expiresAt: string, now: number): number {
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - now) / DAY);
}

/** Expiry bucket: expired (<0) · critical (≤7) · soon (8–30) · later (>30). */
export function urgency(reward: WalletReward, now: number): Urgency {
  if (reward.status === "expired") return "expired";
  const d = daysLeft(reward.expiresAt, now);
  if (d < 0) return "expired";
  if (d <= 7) return "critical";
  if (d <= 30) return "soon";
  return "later";
}

/** A short, honest expiry label for a reward card. */
export function expiryLabel(reward: WalletReward, now: number): string {
  const d = daysLeft(reward.expiresAt, now);
  if (!Number.isFinite(d)) return "no expiry";
  if (d < 0) return "expired";
  if (d === 0) return "expires today";
  return `${d} day${d === 1 ? "" : "s"} left`;
}

// Cash-like reward types — the only ones we may call "cashable". A percent/coupon
// reward isn't cash and must never be presented as redeemable to PayPal balance.
const CASHABLE_TYPES = new Set(["giftcard", "gift_card", "cashback", "credit", "voucher"]);

/** True only when the reward is cash-like AND carries a positive USD value. */
export function isCashable(reward: WalletReward): boolean {
  return reward.valueUsd > 0 && CASHABLE_TYPES.has(reward.type);
}

export interface RescueAction {
  /** `cash` opens the PayPal cash-out; `shop` sends the user to find an eligible buy. */
  kind: "cash" | "shop";
  label: string;
}

/** The honest next action for a reward — never claims cash-out unless supported. */
export function actionFor(reward: WalletReward): RescueAction {
  return isCashable(reward)
    ? { kind: "cash", label: "Cash out to PayPal" }
    : { kind: "shop", label: "Find a way to use it" };
}

export interface RescueSummary {
  /** All non-expired rewards (matches "active rewards"). */
  activeCount: number;
  /** Non-expired rewards expiring within 7 days. */
  expiringSoonCount: number;
  /**
   * Sum of `valueUsd` for non-expired, cash-valued rewards expiring within 30
   * days. Rate rewards (valueUsd 0) contribute nothing — by design.
   */
  valueAtRiskUsd: number;
  counts: Record<Urgency, number>;
}

/** Headline figures for the dashboard, all derived from the real wallet. */
export function summarizeRescue(rewards: WalletReward[], now: number): RescueSummary {
  const counts: Record<Urgency, number> = { expired: 0, critical: 0, soon: 0, later: 0 };
  let activeCount = 0;
  let expiringSoonCount = 0;
  let valueAtRiskUsd = 0;

  for (const r of rewards) {
    const u = urgency(r, now);
    counts[u] += 1;
    if (u === "expired") continue;
    activeCount += 1;
    if (u === "critical") expiringSoonCount += 1;
    if ((u === "critical" || u === "soon") && r.valueUsd > 0) valueAtRiskUsd += r.valueUsd;
  }

  return { activeCount, expiringSoonCount, valueAtRiskUsd, counts };
}

export type RescueFilter = "7d" | "30d" | "all";

/**
 * Active rewards for a filter window, soonest-expiry first. "7d"/"30d" bound by
 * days-left; "all" keeps every non-expired reward. Expired rewards are never shown.
 */
export function filterRewards(rewards: WalletReward[], filter: RescueFilter, now: number): WalletReward[] {
  const active = rewards.filter((r) => urgency(r, now) !== "expired");
  const within =
    filter === "all"
      ? active
      : active.filter((r) => {
          const d = daysLeft(r.expiresAt, now);
          return Number.isFinite(d) && d <= (filter === "7d" ? 7 : 30);
        });
  return [...within].sort((a, b) => daysLeft(a.expiresAt, now) - daysLeft(b.expiresAt, now));
}
