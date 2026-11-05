"use client";

import { AnimatedList, AnimatedNumber } from "@/components/motion";
import type { PlanWithPolicy } from "@/lib/pipeline";
import type { WalletReward } from "@/lib/client";

/**
 * SavingsBreakdown — the optimized, sequentially-revealed money breakdown for
 * the winning plan. Every number is displayed straight from /api/eligibility;
 * the ONLY arithmetic done here is summing the backend-provided `appliedUsd`
 * values (which the brief explicitly defines as "savings"). Total payable now is
 * the backend's `cashUsd` verbatim.
 *
 * Rows reveal in order (AnimatedList stagger):
 *   Merchant price  →  − applied rewards  →  = total payable now (cashUsd)
 * then, if any applied reward is a post-purchase credit (cashback/points/
 * loyalty), those are listed separately as "credited after purchase" using the
 * backend's own appliedUsd — informational, never folded into a new total.
 *
 * The policy decision is surfaced honestly: allow → green "Allowed", ask →
 * amber "Needs approval", deny → red "Denied" with the engine's reasons.
 */
export interface SavingsBreakdownProps {
  plan: PlanWithPolicy;
  /** Wallet rewards keyed by id — used to classify post-purchase credits. */
  rewardsById?: Record<string, WalletReward>;
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const negUsd = (n: number) => `−$${n.toFixed(2)}`;

/** Types that pay the shopper back AFTER purchase rather than cutting cash now. */
const POST_PURCHASE = /cashback|points|loyalty|miles|rebate/i;

const DECISION: Record<
  PlanWithPolicy["policy"]["decision"],
  { text: string; cls: string }
> = {
  allow: { text: "Allowed", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  ask: { text: "Needs approval", cls: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  deny: { text: "Denied", cls: "border-red-500/40 bg-red-500/10 text-red-500" },
};

export function SavingsBreakdown({ plan, rewardsById = {} }: SavingsBreakdownProps) {
  // Savings = sum of the backend's appliedUsd (brief-sanctioned sum, not a recompute).
  const discount = plan.useRewards.reduce((s, a) => s + a.appliedUsd, 0);

  // Split applied rewards into "credited after purchase" vs instant, by wallet type.
  const futureCredits = plan.useRewards.filter((a) =>
    POST_PURCHASE.test(rewardsById[a.rewardId]?.type ?? ""),
  );

  const decision = DECISION[plan.policy.decision];

  return (
    <section aria-label="Savings breakdown" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">Optimized total</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${decision.cls}`}
        >
          {decision.text}
        </span>
      </div>

      <AnimatedList className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div key="price" className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Merchant price</span>
          <AnimatedNumber
            value={plan.offer.priceUsd}
            className="font-medium text-[var(--color-fg)]"
          />
        </div>

        <div key="discount" className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Applied rewards</span>
          <AnimatedNumber
            value={discount}
            format={negUsd}
            className="font-medium text-emerald-500"
          />
        </div>

        <div
          key="total"
          className="mt-1 flex items-center justify-between border-t border-[var(--color-border)] pt-2"
        >
          <span className="text-sm font-semibold text-[var(--color-fg)]">
            Total payable now
          </span>
          <AnimatedNumber
            value={plan.cashUsd}
            className="text-lg font-semibold text-[var(--color-fg)]"
          />
        </div>
      </AnimatedList>

      {futureCredits.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-xs font-medium text-[var(--color-muted)]">
            Credited after purchase
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {futureCredits.map((a) => (
              <li
                key={a.rewardId}
                className="flex items-center justify-between text-sm text-[var(--color-muted)]"
              >
                <span className="capitalize">
                  {rewardsById[a.rewardId]?.source ?? "reward"} ·{" "}
                  {rewardsById[a.rewardId]?.type ?? "credit"}
                </span>
                <span className="tnum font-medium text-[var(--color-fg)]">
                  {usd(a.appliedUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.policy.decision !== "allow" && plan.policy.reasons.length > 0 && (
        <ul className="flex flex-col gap-1">
          {plan.policy.reasons.map((reason, i) => (
            <li
              key={i}
              className={`text-xs ${
                plan.policy.decision === "deny"
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SavingsBreakdown;
