"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWallet, fetchMe, ingestWallet } from "@/lib/client";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RewardPass } from "@/components/wallet/RewardPass";

const usd = (n: number) => `$${n.toFixed(2)}`;
const usdCompact = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_LABEL: Record<string, string> = {
  giftcard: "Gift cards",
  gift_card: "Gift cards",
  points: "Points",
  cashback: "Cashback",
  coupon: "Coupons",
  voucher: "Vouchers",
  credit: "Store credit",
  percent: "% back",
};
const typeLabel = (t: string) =>
  TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1) + "s";

export default function WalletPage() {
  // Session-aware: show the logged-in user's wallet, else fall back to the
  // demo user so the seeded wallet still renders when logged out.
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const userId = me?.userId ?? "demo-user";
  const whose = me ? (me.name ?? me.email ?? me.userId) : "demo wallet";

  const { data: rewards, isLoading, error } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: () => fetchWallet(userId),
  });

  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: () => ingestWallet(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wallet", userId] }),
  });
  const synced = sync.data;

  // Display-only rollups (the optimizer still owns all plan math).
  const summary = useMemo(() => {
    const list = rewards ?? [];
    const total = list.reduce((s, r) => s + r.valueUsd, 0);
    const byType = new Map<string, { count: number; value: number }>();
    for (const r of list) {
      const cur = byType.get(r.type) ?? { count: 0, value: 0 };
      byType.set(r.type, { count: cur.count + 1, value: cur.value + r.valueUsd });
    }
    const groups = [...byType.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.value - a.value);
    return { total, groups, count: list.length };
  }, [rewards]);

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="RePal home" className="shrink-0">
          <RepalLogo size="sm" />
        </Link>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)] sm:gap-5">
          <ThemeToggle />
          <Link href="/" className="hover:text-[var(--color-fg)]">
            Agent
          </Link>
          <Link href="/shop" className="hover:text-[var(--color-fg)]">
            Shop
          </Link>
          <Link href="/wallet" className="text-[var(--color-fg)]">
            Wallet
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        {/* ── Summary (the memorable moment) ───────────────────────────── */}
        <header className="pt-8 sm:pt-12">
          <div className="flex items-start justify-between gap-4">
            <p className="rise inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 font-mono text-xs tracking-wide text-[var(--color-brand)] shadow-sm">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
              Reward wallet
            </p>
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="shrink-0 rounded-full border border-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/5 disabled:opacity-60"
            >
              {sync.isPending ? "Syncing…" : "Sync rewards"}
            </button>
          </div>

          <p
            className="rise font-display mt-5 text-5xl font-medium leading-none tracking-tight text-[var(--color-fg)] sm:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            {isLoading ? "—" : usdCompact(summary.total)}
          </p>
          <p
            className="rise mt-3 text-[var(--color-muted)]"
            style={{ animationDelay: "120ms" }}
          >
            {isLoading
              ? "Loading your auto-imported rewards…"
              : `total reward value across ${summary.count} reward${summary.count === 1 ? "" : "s"}`}{" "}
            · <span className="text-[var(--color-fg)]">{whose}</span>
          </p>

          {/* Type breakdown chips. */}
          {!isLoading && summary.groups.length > 0 && (
            <div className="rise mt-5 flex flex-wrap gap-2" style={{ animationDelay: "180ms" }}>
              {summary.groups.map((g) => (
                <span
                  key={g.type}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs shadow-sm"
                >
                  <span className="font-medium text-[var(--color-fg)]">{typeLabel(g.type)}</span>
                  {g.value > 0 && (
                    <span className="tnum text-[var(--color-muted)]">{usd(g.value)}</span>
                  )}
                  <span className="text-[var(--color-muted)]">· {g.count}</span>
                </span>
              ))}
            </div>
          )}

          {synced && (
            <p className="mt-4 rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              Collected from {Object.keys(synced.bySource).length} sources — {synced.totalAdded} added,{" "}
              {synced.totalUpdated} refreshed.
            </p>
          )}
          {sync.error && (
            <p className="mt-4 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
              {sync.error instanceof Error ? sync.error.message : "Sync failed."}
            </p>
          )}
        </header>

        {error && (
          <p className="mt-8 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
            {error instanceof Error ? error.message : "Failed to load wallet."}
          </p>
        )}

        {/* ── Pass grid ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards?.map((r, i) => (
              <RewardPass key={r.id} reward={r} index={i} />
            ))}
          </div>
        )}

        {!isLoading && rewards?.length === 0 && (
          <div className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              No rewards yet. Seed the database (<code className="font-mono">npm run prisma:seed</code>)
              or connect a source with <span className="font-medium text-[var(--color-fg)]">Sync rewards</span>.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
