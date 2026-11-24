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

const DECISION: Record<
  PlanWithPolicy["policy"]["decision"],
  { text: string; cls: string }
> = {
  allow: { text: "Allowed", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  ask: { text: "Needs approval", cls: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  deny: { text: "Denied", cls: "border-red-500/40 bg-red-500/10 text-red-500" },
};

export function SavingsBreakdown({ plan, rewardsById = {} }: SavingsBreakdownProps) {
  // Each reward is tagged by the optimizer with how it's realised. ONLY instant
  // discounts reduce the charge now; cashback is a post-purchase estimate and
  // points are redemption-dependent — both shown separately so "total payable
  // now" is financially accurate. All figures come straight from /api/eligibility.
  const instant = plan.savedUsd;
  const cashback = plan.cashbackUsd ?? 0;
  const points = plan.pointsUsd ?? 0;
  const estimatedAfter = Math.max(0, plan.cashUsd - cashback);
  const cashbackRewards = plan.useRewards.filter((a) => a.effect === "cashback");
  const pointsRewards = plan.useRewards.filter((a) => a.effect === "points");
  const label = (id: string) =>
    `${rewardsById[id]?.source ?? "reward"} · ${rewardsById[id]?.type ?? "credit"}`;

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
          <span className="text-[var(--color-muted)]">Instant rewards (applied now)</span>
          <AnimatedNumber
            value={instant}
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

      {(cashback > 0 || points > 0) && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-xs font-semibold text-[var(--color-muted)]">After purchase</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {cashbackRewards.map((a) => (
              <li
                key={a.rewardId}
                className="flex items-center justify-between gap-3 text-sm text-[var(--color-muted)]"
              >
                <span className="capitalize">{label(a.rewardId)} (post-purchase, est.)</span>
                <span className="tnum font-medium text-emerald-500">{negUsd(a.appliedUsd)}</span>
              </li>
            ))}
            {pointsRewards.map((a) => (
              <li
                key={a.rewardId}
                className="flex items-center justify-between gap-3 text-sm text-[var(--color-muted)]"
              >
                <span className="capitalize">{label(a.rewardId)} (value depends on redemption)</span>
                <span className="tnum font-medium text-[var(--color-fg)]">~{usd(a.appliedUsd)}</span>
              </li>
            ))}
          </ul>
          {cashback > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-sm">
              <span className="font-medium text-[var(--color-fg)]">Est. value after cashback</span>
              <span className="tnum font-semibold text-[var(--color-fg)]">{usd(estimatedAfter)}</span>
            </div>
          )}
          <p className="mt-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
            Post-purchase credits and points don&apos;t reduce today&apos;s PayPal charge.
          </p>
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
