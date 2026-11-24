"use client";

import { rewardEffect } from "@/lib/optimizer/evaluate";
import type { WalletReward } from "@/lib/client";

/**
 * The "Rewards for this purchase" header + connected-sources summary, derived
 * honestly from the user's own rewards. Card-linked offers (cashback), loyalty
 * programs (points) and the RePal balance are three DISTINCT inventories — a
 * credit card is a funding source; its cashback programme is a reward source.
 * Labelled illustrative because PayPal never exposes a buyer's real issuer
 * connections to a third-party app (only RePal-vaulted tokens are readable).
 */
const usd = (n: number) => `$${n.toFixed(2)}`;

function Item({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--color-fg)]">{value}</p>
        <p className="truncate text-[12px] text-[var(--color-muted)]">{label}</p>
      </div>
    </div>
  );
}

const CardIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const LoyaltyIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const MarkIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function ConnectedSourcesBar({ rewards }: { rewards: WalletReward[] }) {
  const cardOffers = rewards.filter((r) => rewardEffect(r) === "cashback").length;
  const loyalty = rewards.filter((r) => rewardEffect(r) === "points").length;
  const repalBalance = rewards
    .filter((r) => r.source === "repal")
    .reduce((s, r) => s + (r.valueUsd || 0), 0);

  return (
    <section aria-label="Connected reward sources" className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-fg)]">Rewards for this purchase</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
          RePal gathers your rewards, checks issuer and merchant terms, and finds the best eligible stack.
        </p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Item icon={CardIcon} value={`${cardOffers} ${cardOffers === 1 ? "Card offer" : "Card offers"}`} label="Card-linked offers & cashback" />
        <Item icon={LoyaltyIcon} value={`${loyalty} ${loyalty === 1 ? "Loyalty program" : "Loyalty programs"}`} label="Brand & partner rewards" />
        <Item icon={MarkIcon} value="RePal balance" label={`${usd(repalBalance)} available`} />
      </div>

      <p className="text-right text-[11px] text-[var(--color-muted)]">
        Illustrative / demo accounts — not live issuer connections.
      </p>
    </section>
  );
}

export default ConnectedSourcesBar;
