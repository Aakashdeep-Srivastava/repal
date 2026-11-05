"use client";

import { AnimatedList } from "@/components/motion";
import type { AppliedReward, RejectedReward } from "@/lib/types";
import type { WalletReward } from "@/lib/client";

/**
 * RewardMapping — shows, honestly, exactly which of the user's rewards the
 * deterministic optimizer applied to THIS product and which it rejected (and
 * why, with the verbatim disqualifying clause).
 *
 * Contract honesty rules enforced here:
 *  - ELIGIBLE rewards (the winner's `useRewards`) are the only ones shown as
 *    applied — each with a ✓, its backend `appliedUsd`, and a wallet label.
 *  - REJECTED rewards are rendered in a collapsed, visually muted section and
 *    are NEVER styled as applied; each shows the human reason and the quoted
 *    clause so the exclusion is auditable.
 *  - If zero rewards apply, that is stated plainly rather than implied away.
 *
 * All money values come straight from /api/eligibility — nothing is recomputed.
 */
export interface RewardMappingProps {
  /** Winner plan's applied rewards: {rewardId, appliedUsd}[]. */
  eligible: AppliedReward[];
  /** Rewards the optimizer excluded, with reason + quoted clause. */
  rejected: RejectedReward[];
  /** Wallet rewards keyed by id, for human labels (source/type/value/terms). */
  rewardsById: Record<string, WalletReward>;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

function label(r: WalletReward | undefined, id: string): string {
  if (!r) return `Reward ${id.slice(0, 6)}`;
  return `${r.source} · ${r.type}`;
}

export function RewardMapping({ eligible, rejected, rewardsById }: RewardMappingProps) {
  const hasEligible = eligible.length > 0;

  return (
    <section aria-label="Reward eligibility" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[var(--color-fg)]">Rewards applied</h2>

      {hasEligible ? (
        <AnimatedList className="flex flex-col gap-2">
          {eligible.map((e) => {
            const r = rewardsById[e.rewardId];
            return (
              <div
                key={e.rewardId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white"
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize text-[var(--color-fg)]">
                      {label(r, e.rewardId)}
                    </p>
                    {r?.termsRaw && (
                      <p className="truncate text-xs text-[var(--color-muted)]">{r.termsRaw}</p>
                    )}
                  </div>
                </div>
                <span className="tnum shrink-0 text-sm font-semibold text-emerald-500">
                  −{usd(e.appliedUsd)}
                </span>
              </div>
            );
          })}
        </AnimatedList>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-muted)]">
          No rewards apply to this item — you'll pay the merchant price.
        </p>
      )}

      {rejected.length > 0 && (
        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[var(--color-muted)]">
            {rejected.length} reward{rejected.length === 1 ? "" : "s"} didn&apos;t apply
          </summary>
          <ul className="flex flex-col gap-2 px-3 pb-3">
            {rejected.map((rj) => {
              const r = rewardsById[rj.rewardId];
              return (
                <li
                  key={rj.rewardId}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium capitalize text-[var(--color-muted)] line-through decoration-[var(--color-muted)]/50">
                      {label(r, rj.rewardId)}
                    </span>
                    {r && (
                      <span className="tnum shrink-0 text-xs text-[var(--color-muted)]">
                        {usd(r.valueUsd)} unused
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{rj.reason}</p>
                  {rj.quotedClause && (
                    <blockquote className="mt-1 border-l-2 border-[var(--color-border)] pl-2 text-xs italic text-[var(--color-muted)]">
                      &ldquo;{rj.quotedClause}&rdquo;
                    </blockquote>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

export default RewardMapping;
