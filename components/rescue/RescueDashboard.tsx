"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RepalLoader from "@/components/brand/RepalLoader";
import { RewardPass } from "@/components/wallet/RewardPass";
import RewardTimeline from "@/components/rescue/RewardTimeline";
import { fetchMe, fetchWallet, type WalletReward } from "@/lib/client";
import {
  summarizeRescue,
  filterRewards,
  urgency,
  expiryLabel,
  isCashable,
  actionFor,
  type RescueFilter,
  type Urgency,
} from "@/lib/rewards/rescue";

/**
 * RescueDashboard — the rewards-recovery experience. Every figure is derived from
 * the user's REAL wallet (`/api/wallet`) via lib/rewards/rescue (pure, tested);
 * nothing is fabricated. Cash-out is offered ONLY for cash-like rewards and reuses
 * the existing signed-receipt payout flow (RewardPass). Non-cashable rewards get a
 * "find a way to use it" action into Discover — never a false cash-out promise.
 */

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;

const TYPE_LABEL: Record<string, string> = {
  giftcard: "Gift card", gift_card: "Gift card", points: "Points", cashback: "Cashback",
  coupon: "Coupon", voucher: "Voucher", credit: "Store credit", percent: "% back",
};
const TYPE_GLYPH: Record<string, string> = {
  giftcard: "🎁", gift_card: "🎁", points: "⭐", cashback: "💸", coupon: "🏷️",
  voucher: "🎟️", credit: "🏦", percent: "％",
};
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

function headline(r: WalletReward): string {
  if (r.valueUsd > 0) return usd(r.valueUsd);
  const pct = r.termsRaw.match(/(\d+(?:\.\d+)?)\s*%/);
  return pct ? `${pct[1]}%` : "—";
}

const URGENCY_CHIP: Record<Exclude<Urgency, "expired">, string> = {
  critical: "bg-[color-mix(in_oklab,var(--color-danger)_16%,transparent)] text-[var(--color-danger)]",
  soon: "bg-[color-mix(in_oklab,var(--color-warn)_18%,transparent)] text-[var(--color-warn)]",
  later: "bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] text-[var(--color-brand)]",
};

export default function RescueDashboard() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const userId = me?.userId ?? "demo-user";
  const { data: rewards, isLoading, isError, refetch } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: () => fetchWallet(userId),
  });

  const [filter, setFilter] = useState<RescueFilter>("7d");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // One stable `now` per render pass keeps every derived figure consistent.
  const now = useMemo(() => Date.now(), [rewards]);
  const all = rewards ?? [];
  const summary = useMemo(() => summarizeRescue(all, now), [all, now]);
  const list = useMemo(() => filterRewards(all, filter, now), [all, filter, now]);
  const active = useMemo(() => all.filter((r) => urgency(r, now) !== "expired"), [all, now]);
  const soonest = useMemo(
    () => [...active].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0],
    [active],
  );
  const selected = all.find((r) => r.id === selectedId && isCashable(r)) ?? null;

  function onReward(r: WalletReward) {
    if (isCashable(r)) setSelectedId((id) => (id === r.id ? null : r.id));
  }

  return (
    <div className="space-y-7">
      {/* Hero */}
      <header>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)]">
            🛟 Rescue · Rewards intelligence
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Don&apos;t let your rewards expire.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)] sm:text-base">
          RePal surfaces your expiring rewards and the best way to put each one to use — before it vanishes.
        </p>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone="danger"
          value={usd(summary.valueAtRiskUsd)}
          label="Value at risk"
          hint="Cash-value rewards expiring within 30 days. Rate rewards (e.g. 5%) aren't counted — their worth depends on what you buy."
          loading={isLoading}
        />
        <StatCard tone="warn" value={String(summary.expiringSoonCount)} label="Expiring soon" hint="Rewards expiring within 7 days." loading={isLoading} />
        <StatCard tone="brand" value={String(summary.activeCount)} label="Active rewards" hint="All non-expired rewards in your wallet." loading={isLoading} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column — expiring list */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Expiring soon</h2>
            <FilterTabs value={filter} onChange={setFilter} />
          </div>

          {/* Inline cash-out for a selected cashable reward (reuses payout flow) */}
          <AnimatePresence initial={false}>
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="overflow-hidden"
              >
                <p className="mb-2 text-sm font-semibold">Cash out this reward to PayPal</p>
                <div className="max-w-md">
                  <RewardPass
                    reward={selected}
                    index={0}
                    defaultEmail={me?.email}
                    onCashedOut={() => {
                      qc.invalidateQueries({ queryKey: ["wallet", userId] });
                      setSelectedId(null);
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border)]" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : list.length === 0 ? (
            <EmptyState hasAny={active.length > 0} />
          ) : (
            <ul className="space-y-3">
              {list.map((r) => (
                <RewardRow key={r.id} reward={r} now={now} onAction={onReward} open={selectedId === r.id} />
              ))}
            </ul>
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-5">
          <div className="card rounded-[var(--radius-xl)] p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">📅 Your reward timeline</h3>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">All active rewards by expiry date</p>
            <div className="mt-4">
              {isLoading ? (
                <div className="flex h-20 items-center justify-center"><RepalLoader size={28} label="Loading" /></div>
              ) : (
                <RewardTimeline rewards={active} now={now} onSelect={(id) => { const r = all.find((x) => x.id === id); if (r) onReward(r); }} />
              )}
            </div>
          </div>

          {soonest && (
            <div className="card rounded-[var(--radius-xl)] p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand)]">✦ Recommended action</h3>
              <p className="mt-2 text-sm font-semibold">
                {headline(soonest)} {typeLabel(soonest.type)} · <span className="text-[var(--color-danger)]">{expiryLabel(soonest, now)}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Your soonest-expiring reward. {actionFor(soonest).label} before it&apos;s gone.</p>
              {isCashable(soonest) ? (
                <button onClick={() => onReward(soonest)} className="mt-3 w-full rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110">
                  {actionFor(soonest).label} →
                </button>
              ) : (
                <Link href="/shop" className="mt-3 block rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:brightness-110">
                  Find eligible products →
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Honesty footer */}
      <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs text-[var(--color-muted)]">
        ⓘ Values and expiries come from your actual imported rewards. Rewards are subject to each issuer&apos;s terms and eligibility —
        only cash-like rewards (gift cards, cashback) can be cashed out to PayPal; others are best used toward an eligible purchase.
      </p>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ tone, value, label, hint, loading }: { tone: "danger" | "warn" | "brand"; value: string; label: string; hint: string; loading?: boolean }) {
  const ring = {
    danger: "bg-[color-mix(in_oklab,var(--color-danger)_7%,var(--color-card))]",
    warn: "bg-[color-mix(in_oklab,var(--color-warn)_8%,var(--color-card))]",
    brand: "bg-[color-mix(in_oklab,var(--color-brand)_7%,var(--color-card))]",
  }[tone];
  const dot = { danger: "var(--color-danger)", warn: "var(--color-warn)", brand: "var(--color-brand)" }[tone];
  return (
    <div className={`card ${ring} rounded-[var(--radius-xl)] p-5`} title={hint}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: dot }} />
        <span className="text-xs font-medium text-[var(--color-muted)]">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tnum">{loading ? "—" : value}</p>
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: RescueFilter; onChange: (f: RescueFilter) => void }) {
  const tabs: { k: RescueFilter; label: string }[] = [
    { k: "7d", label: "Next 7 days" },
    { k: "30d", label: "Next 30 days" },
    { k: "all", label: "All rewards" },
  ];
  return (
    <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-1 text-sm">
      {tabs.map((t) => (
        <button
          key={t.k}
          onClick={() => onChange(t.k)}
          aria-pressed={value === t.k}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            value === t.k ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RewardRow({ reward, now, onAction, open }: { reward: WalletReward; now: number; onAction: (r: WalletReward) => void; open: boolean }) {
  const u = urgency(reward, now) as Exclude<Urgency, "expired">;
  const action = actionFor(reward);
  const terms = reward.termsRaw.trim();
  return (
    <li className={`card card-hover rounded-[var(--radius-lg)] p-4 ${u === "critical" ? "ring-1 ring-[color-mix(in_oklab,var(--color-danger)_30%,transparent)]" : ""}`}>
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] text-xl" aria-hidden>
          {TYPE_GLYPH[reward.type] ?? "🎟️"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{typeLabel(reward.type)}</p>
            <span className="shrink-0 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-muted)]">{reward.source}</span>
          </div>
          {terms && <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]" title={terms}>{terms}</p>}
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCY_CHIP[u]}`}>
            ⏱ {expiryLabel(reward, now)}
          </span>
          <p className="mt-1 text-lg font-semibold tnum">{headline(reward)}</p>
        </div>
        {action.kind === "cash" ? (
          <button
            onClick={() => onAction(reward)}
            aria-expanded={open}
            className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            {open ? "Close" : "Cash out"}
          </button>
        ) : (
          <Link
            href="/shop"
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-brand)] px-3.5 py-2 text-sm font-semibold text-[var(--color-brand)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)]"
          >
            Use it →
          </Link>
        )}
      </div>
      {/* Mobile value/expiry row */}
      <div className="mt-3 flex items-center justify-between sm:hidden">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCY_CHIP[u]}`}>⏱ {expiryLabel(reward, now)}</span>
        <p className="text-lg font-semibold tnum">{headline(reward)}</p>
      </div>
    </li>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="card rounded-[var(--radius-lg)] p-8 text-center">
      <p className="text-2xl">✅</p>
      <p className="mt-2 text-sm font-medium">{hasAny ? "Nothing expiring in this window." : "No active rewards yet."}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        {hasAny ? "Switch to “All rewards” to see everything, or relax." : "Log in (try Judge demo) or connect a source to fill your wallet."}
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card rounded-[var(--radius-lg)] border-[color-mix(in_oklab,var(--color-danger)_30%,var(--color-border))] p-6 text-center">
      <p className="text-sm font-medium text-[var(--color-danger)]">Couldn&apos;t load your rewards.</p>
      <button onClick={onRetry} className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg)]">Try again</button>
    </div>
  );
}
