import type { ReactNode } from "react";

export interface PlanCardData {
  name: string;
  offer: { id: string; title: string; priceUsd: number; retailer: string; buyUrl: string };
  useRewards: { rewardId: string; appliedUsd: number }[];
  savedUsd: number;
  cashUsd: number;
  policy: { decision: "allow" | "ask" | "deny"; reasons: string[] };
}

export interface RejectedRewardData {
  rewardId: string;
  reason: string;
  quotedClause?: string;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

const POLICY_STYLES: Record<string, string> = {
  allow: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  ask: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  deny: "border-red-500/40 bg-red-500/10 text-red-400",
};
const POLICY_LABEL: Record<string, string> = {
  allow: "✓ Allowed",
  ask: "⚠ Needs approval",
  deny: "✕ Denied",
};

function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function PlanCards({
  plans,
  rejected = [],
}: {
  plans: PlanCardData[];
  rejected?: RejectedRewardData[];
}) {
  if (!plans.length) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">
        No plans yet — run the optimizer above to see the cheapest option after your rewards.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <div
            key={plan.offer.id + i}
            className={`flex flex-col rounded-2xl border p-5 ${
              i === 0 ? "border-[var(--color-brand)]/60 bg-[var(--color-brand)]/5" : "border-[var(--color-border)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge
                className={
                  i === 0
                    ? "border-[var(--color-brand)]/50 bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)]"
                }
              >
                {i === 0 ? "Cheapest after rewards" : plan.name}
              </Badge>
              <Badge className={POLICY_STYLES[plan.policy.decision] ?? ""}>
                {POLICY_LABEL[plan.policy.decision] ?? plan.policy.decision}
              </Badge>
            </div>

            <h3 className="mt-3 text-base font-semibold leading-snug">{plan.offer.title}</h3>
            <p className="text-xs text-[var(--color-muted)]">{plan.offer.retailer}</p>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="tnum text-3xl font-semibold">{usd(plan.cashUsd)}</span>
              {plan.savedUsd > 0 && (
                <span className="tnum text-sm text-[var(--color-muted)] line-through">
                  {usd(plan.offer.priceUsd)}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)]">cash after rewards</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {plan.savedUsd > 0 && (
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  you save {usd(plan.savedUsd)}
                </Badge>
              )}
              <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                {plan.useRewards.length} reward{plan.useRewards.length === 1 ? "" : "s"} applied
              </Badge>
            </div>

            {plan.policy.decision !== "allow" && plan.policy.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
                {plan.policy.reasons.map((r, j) => (
                  <li key={j}>• {r}</li>
                ))}
              </ul>
            )}

            <a
              href={plan.offer.buyUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-auto pt-4 text-xs font-medium text-[var(--color-brand)] hover:underline"
            >
              View offer →
            </a>
          </div>
        ))}
      </div>

      {rejected.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] p-5">
          <h4 className="text-sm font-semibold">Rewards that didn&apos;t apply</h4>
          <ul className="mt-3 space-y-2">
            {rejected.map((r, i) => (
              <li key={r.rewardId + i} className="text-sm">
                <span className="text-[var(--color-muted)]">{r.reason}</span>
                {r.quotedClause && (
                  <span className="text-[var(--color-muted)]">
                    {" "}
                    — <em>&ldquo;{r.quotedClause}&rdquo;</em>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
