"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchInsights, type InsightsData } from "@/lib/client";

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 font-display text-2xl font-medium tracking-tight ${accent ? "text-[var(--color-brand)]" : "text-[var(--color-fg)]"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

/** Lightweight stacked bars (spend + saved) — theme-tokened, no chart lib. */
function SpendChart({ series }: { series: InsightsData["series"] }) {
  const max = Math.max(1, ...series.map((d) => d.spent + d.saved));
  const H = 160;
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: H }}>
        {series.map((d) => {
          const spentH = (d.spent / max) * H;
          const savedH = (d.saved / max) * H;
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col justify-end"
              title={`${d.date} · ${usd(d.spent)} spent · ${usd(d.saved)} saved`}
            >
              {savedH > 0 && (
                <div style={{ height: savedH, background: "var(--color-cyan)" }} className="rounded-t-[2px] opacity-75" />
              )}
              {spentH > 0 && <div style={{ height: spentH, background: "var(--color-brand)" }} />}
              {spentH + savedH === 0 && <div style={{ height: 2 }} className="bg-[var(--color-border)]" />}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--color-brand)" }} /> Cash spent</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm opacity-75" style={{ background: "var(--color-cyan)" }} /> Saved with rewards</span>
        <span className="ml-auto">last 30 days</span>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["insights"], queryFn: fetchInsights });

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="RePal home" className="shrink-0"><RepalLogo size="sm" /></Link>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)] sm:gap-5">
          <ThemeToggle />
          <Link href="/" className="hover:text-[var(--color-fg)]">Agent</Link>
          <Link href="/wallet" className="hover:text-[var(--color-fg)]">Wallet</Link>
          <Link href="/insights" className="text-[var(--color-fg)]">Insights</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <header className="pt-8 sm:pt-12">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 font-mono text-xs tracking-wide text-[var(--color-brand)] shadow-sm">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
            Insights
          </p>
          <h1 className="rise font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl" style={{ animationDelay: "60ms" }}>
            Every dollar, after your rewards.
          </h1>
          <p className="rise mt-3 max-w-2xl text-[var(--color-muted)]" style={{ animationDelay: "120ms" }}>
            Built from your signed receipts, payouts, and refunds — each number is verifiable.
          </p>
        </header>

        {isLoading || !data ? (
          <div className="mt-8 h-64 animate-pulse rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Kpi label="Cash spent" value={usd(data.kpis.totalSpent)} hint={`${data.kpis.purchases} purchases`} />
              <Kpi label="Saved with rewards" value={usd(data.kpis.totalSaved)} accent hint="after rewards" />
              <Kpi label="Cashed out" value={usd(data.kpis.totalLiberated)} hint={`${data.kpis.payouts} payouts`} />
              <Kpi label="Refunded" value={usd(data.kpis.totalRefunded)} hint={`${data.kpis.refunds} refunds`} />
            </div>

            <section className="mt-6 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Spend &amp; savings</h2>
              <div className="mt-4"><SpendChart series={data.series} /></div>
            </section>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5">{data.kpis.runs} agent runs</span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5">{data.kpis.activeMandate > 0 ? "mandate active" : "no active mandate"}</span>
            </div>

            <section className="mt-6">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Recent activity</h2>
              <div className="mt-3 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)]">
                {data.recent.length === 0 ? (
                  <p className="bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted)]">
                    No receipts yet — run the agent or check out a plan to see activity here.
                  </p>
                ) : (
                  data.recent.map((r) => (
                    <Link
                      key={r.id}
                      href={r.verifyUrl}
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 last:border-0 hover:bg-[var(--color-bg)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-fg)]">{r.item}</p>
                        <p className="truncate text-xs text-[var(--color-muted)]">{r.merchant} · {r.category} · {new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum text-sm font-medium text-[var(--color-fg)]">{usd(r.cashUsd)}</p>
                        {r.savedUsd > 0 && <p className="tnum text-xs text-[var(--color-brand)]">saved {usd(r.savedUsd)}</p>}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
