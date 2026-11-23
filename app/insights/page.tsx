"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell, I } from "@/components/dashboard/shell";
import { fetchInsights, type InsightsData } from "@/lib/client";

// AG Grid is browser-measured — load it client-side only. Used for the full,
// filterable "view all" receipts view (preserves sort/filter/search/pagination).
const TransactionGrid = dynamic(() => import("@/components/insights/TransactionGrid"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
  ),
});

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

type IconFn = (p: { className?: string }) => React.ReactNode;

/* ─────────────────── KPI card ─────────────────── */
function Kpi({
  label,
  value,
  hint,
  sub,
  icon: Icon,
  tint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  sub?: React.ReactNode;
  icon: IconFn;
  tint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-medium text-[var(--color-muted)]">{label}</p>
          <p
            className={`mt-1.5 font-display text-[28px] font-semibold leading-none tracking-tight ${
              accent ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-fg)]"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${tint}1a`, color: tint }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint && <p className="mt-3 text-[12.5px] text-[var(--color-muted)]">{hint}</p>}
      {sub}
    </div>
  );
}

/* ─────────────────── Spend & savings trend ─────────────────── */
function SpendChart({ series }: { series: InsightsData["series"] }) {
  const max = Math.max(1, ...series.map((d) => d.spent + d.saved));
  const H = 180;
  // Only label a few x-ticks so the axis stays readable.
  const ticks = [0, Math.floor(series.length / 2), series.length - 1];
  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height: H }}>
        {/* horizontal gridlines */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-px w-full bg-[var(--color-border)] opacity-50" />
          ))}
        </div>
        {series.map((d) => {
          const spentH = (d.spent / max) * H;
          const savedH = (d.saved / max) * H;
          const empty = spentH + savedH === 0;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col justify-end"
              title={`${d.date} · ${usd(d.spent)} spent · ${usd(d.saved)} saved`}
            >
              {savedH > 0 && (
                <div
                  style={{ height: savedH, background: "var(--color-cyan)" }}
                  className="rounded-t-[3px] opacity-80 transition-opacity group-hover:opacity-100"
                />
              )}
              {spentH > 0 && (
                <div
                  style={{ height: spentH }}
                  className={`bg-[var(--color-brand)] transition-opacity group-hover:opacity-90 ${savedH > 0 ? "" : "rounded-t-[3px]"}`}
                />
              )}
              {empty && <div style={{ height: 2 }} className="rounded-full bg-[var(--color-border)]" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--color-muted)]">
        {ticks.map((t) => (
          <span key={t}>{series[t] ? fmtDate(series[t].date).replace(/,.*/, "") : ""}</span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-brand)" }} /> Cash spent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm opacity-80" style={{ background: "var(--color-cyan)" }} /> Saved with rewards
        </span>
        <span className="ml-auto">last 30 days</span>
      </div>
    </div>
  );
}

/* ─────────────────── Savings breakdown (donut) ─────────────────── */
const DONUT_COLORS = ["#2457e6", "#11ace3", "#7c5cff", "#10b981", "#94a3b8"];

function SavingsDonut({ recent, total }: { recent: InsightsData["recent"]; total: number }) {
  const segments = useMemo(() => {
    const byMerchant = new Map<string, number>();
    for (const r of recent) {
      if (r.savedUsd > 0) byMerchant.set(r.merchant, (byMerchant.get(r.merchant) ?? 0) + r.savedUsd);
    }
    const sorted = [...byMerchant.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const otherSum = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const out = top.map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i] }));
    if (otherSum > 0) out.push({ label: "Other", value: otherSum, color: DONUT_COLORS[4] });
    return out;
  }, [recent]);

  const segTotal = segments.reduce((s, x) => s + x.value, 0);
  if (segTotal <= 0) {
    return (
      <p className="flex h-full min-h-[180px] items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-bg)] p-6 text-center text-[13px] text-[var(--color-muted)]">
        No realized savings yet. Once the agent applies rewards on a purchase, the split by merchant appears here.
      </p>
    );
  }

  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-border)" strokeWidth="16" opacity="0.4" />
        {segments.map((s) => {
          const len = (s.value / segTotal) * C;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl font-semibold tracking-tight text-[var(--color-fg)]">{usd(segTotal)}</p>
        <p className="text-[12.5px] text-[var(--color-muted)]">total saved · by merchant</p>
        <ul className="mt-3 space-y-1.5">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">{s.label}</span>
              <span className="text-[var(--color-muted)]">{usd(s.value)}</span>
              <span className="w-9 text-right tabular-nums text-[var(--color-muted)]">
                {Math.round((s.value / segTotal) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────── Recent activity feed ─────────────────── */
function ActivityFeed({ recent }: { recent: InsightsData["recent"] }) {
  const [showAll, setShowAll] = useState(false);
  if (showAll) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12.5px] text-[var(--color-muted)]">Sort, filter and search every signed receipt.</p>
          <button
            onClick={() => setShowAll(false)}
            className="text-[13px] font-medium text-[var(--color-brand)] hover:underline"
          >
            ← Compact view
          </button>
        </div>
        <TransactionGrid rows={recent} />
      </div>
    );
  }
  return (
    <>
    <ul className="divide-y divide-[var(--color-border)]">
      {recent.slice(0, 6).map((r) => (
        <li key={r.id}>
          <Link
            href={r.verifyUrl}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--color-bg)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[13px] font-semibold text-[var(--color-brand)]">
              {r.merchant.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--color-fg)]">{r.item}</p>
              <p className="truncate text-[12px] text-[var(--color-muted)]">
                {r.merchant} · Receipt #{r.id.slice(-6).toUpperCase()}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[14px] font-semibold tabular-nums text-[var(--color-fg)]">{usd(r.cashUsd)}</p>
              <p className="text-[11.5px] text-[var(--color-muted)]">{fmtDate(r.createdAt)}</p>
            </div>
            {r.savedUsd > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                Saved {usd(r.savedUsd)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
    {recent.length > 6 && (
      <button
        onClick={() => setShowAll(true)}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-brand)] hover:underline"
      >
        View all {recent.length} receipts →
      </button>
    )}
    </>
  );
}

/* ─────────────────── Panel wrapper ─────────────────── */
function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ─────────────────── Page ─────────────────── */
function Dashboard({ data }: { data: InsightsData }) {
  const k = data.kpis;
  const hasActivity = k.purchases > 0 || k.payouts > 0 || k.refunds > 0 || k.payoutsSimulated > 0;

  return (
    <div className="mt-6 space-y-5">
      {/* KPI row — always visible; real zeros, never fabricated */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total spend"
          value={usd(k.totalSpent)}
          hint={`${k.purchases} ${k.purchases === 1 ? "purchase" : "purchases"}`}
          icon={I.wallet}
          tint="#2457e6"
        />
        <Kpi
          label="Saved with rewards"
          value={usd(k.totalSaved)}
          hint="from signed receipts"
          icon={I.gift}
          tint="#10b981"
          accent
        />
        <Kpi
          label="Cashed out (payouts)"
          value={usd(k.totalLiberated)}
          hint={`${k.payouts} completed`}
          icon={I.coin}
          tint="#7c5cff"
          sub={
            k.totalSimulated > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11.5px] font-medium text-amber-600 dark:text-amber-400">
                + {usd(k.totalSimulated)} simulated
              </p>
            ) : undefined
          }
        />
        <Kpi
          label="Refunded"
          value={usd(k.totalRefunded)}
          hint={`${k.refunds} ${k.refunds === 1 ? "refund" : "refunds"}`}
          icon={I.scale}
          tint="#f59e0b"
        />
      </div>

      {!hasActivity ? (
        /* Intentional empty state — not a fabricated chart */
        <section className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <I.insights className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-[var(--color-fg)]">
            No verified activity yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--color-muted)]">
            Your impact dashboard fills in from signed receipts, payouts and refunds — each number independently
            verifiable. Run the agent or check out a plan to see real spend and savings here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Browse the shop <I.arrow className="h-4 w-4" />
            </Link>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-semibold text-[var(--color-fg)] transition-colors hover:border-[var(--color-brand)]/40"
            >
              View wallet
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel title="Spend & savings trend" className="xl:col-span-2">
              <SpendChart series={data.series} />
            </Panel>
            <Panel title="Savings breakdown">
              <SavingsDonut recent={data.recent} total={k.totalSaved} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel
              title="Recent activity"
              className="xl:col-span-2"
              action={<span className="text-[12px] text-[var(--color-muted)]">{data.recent.length} receipts</span>}
            >
              <ActivityFeed recent={data.recent} />
            </Panel>

            <Panel title="Verified & in your control">
              <ul className="space-y-3 text-[13.5px]">
                <li className="flex gap-2.5">
                  <I.shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[var(--color-muted)]">
                    Every figure is computed from{" "}
                    <span className="font-medium text-[var(--color-fg)]">Ed25519-signed receipts</span> you can verify.
                  </span>
                </li>
                <li className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-[var(--color-muted)]">Agent runs</span>
                  <span className="font-semibold tabular-nums text-[var(--color-fg)]">{k.runs}</span>
                </li>
                <li className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-[var(--color-muted)]">Spending mandate</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${
                      k.activeMandate > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-muted)]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${k.activeMandate > 0 ? "bg-emerald-500" : "bg-slate-400"}`}
                    />
                    {k.activeMandate > 0 ? "Active" : "Inactive"}
                  </span>
                </li>
                <li className="border-t border-[var(--color-border)] pt-3">
                  <Link href="/mandate" className="text-[13px] font-medium text-[var(--color-brand)] hover:underline">
                    Manage spending authority →
                  </Link>
                </li>
              </ul>
            </Panel>
          </div>
        </>
      )}

      {/* Operator reporting is deliberately NOT customer financial data — it lives
          on its own page, linked subtly for operators. */}
      <p className="pt-1 text-right text-[11.5px] text-[var(--color-muted)]">
        <Link href="/operations" className="hover:text-[var(--color-fg)] hover:underline">
          Operator reporting →
        </Link>
      </p>
    </div>
  );
}

export default function InsightsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["insights"], queryFn: fetchInsights });

  return (
    <DashboardShell
      title="Your RePal impact"
      subtitle="Verified spend, realized reward savings, refunds and payouts — every number from a signed receipt."
    >
      {isLoading || !data ? (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[116px] animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
        </div>
      ) : (
        <Dashboard data={data} />
      )}
    </DashboardShell>
  );
}
