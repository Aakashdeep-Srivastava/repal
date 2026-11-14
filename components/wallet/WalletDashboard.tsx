"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWallet, ingestWallet, fetchInsights, fetchMandate } from "@/lib/client";
import { RewardCardV2 } from "@/components/wallet/RewardCardV2";
import { ConnectGmail } from "@/components/wallet/ConnectGmail";
import { PaymentMethods } from "@/components/wallet/PaymentMethods";
import { DashboardShell, useShellUser, intentRoute, usd, timeAgo, I, Mark } from "@/components/dashboard/shell";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">{icon}</span>
      <div className="min-w-0"><div className="tnum text-[16px] font-semibold leading-none text-white">{value}</div><div className="mt-1 truncate text-[11.5px] text-white/70">{label}</div></div>
    </div>
  );
}

function AgentPanel() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const chips = [
    { label: "Buy Nike shoes under $120", go: () => router.push("/shop?q=nike+shoes") },
    { label: "Cash out my expiring rewards", go: () => router.push("/rescue") },
    { label: "Set my spending mandate", go: () => router.push("/mandate") },
  ];
  return (
    <div className="flex flex-col rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-xl shadow-sm" style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}>
          <span aria-hidden className="absolute -inset-1.5 -z-10 rounded-full opacity-50 blur-md animate-pulse" style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }} />
          <Mark className="relative h-5 w-5 brightness-0 invert" />
        </span>
        <span className="text-[17px] font-semibold text-[var(--color-fg)]">RePal Agent</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)] animate-pulse" />Powered by AI</span>
      </div>
      <p className="mt-4 text-[15px] text-[var(--color-fg)]">Tell me what you want to buy <span className="font-semibold">or save on.</span></p>
      <div className="mt-4 flex flex-col gap-2.5">
        {chips.map((c) => <button key={c.label} onClick={c.go} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-left text-[13.5px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><I.sparkle className="h-4 w-4" /></span>{c.label}</button>)}
        <Link href="/shop" className="px-1.5 text-left text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-brand)]">··· More examples</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (goal.trim()) intentRoute(router, goal); }} className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-4 pr-1.5"><input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Type a goal…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]" /><button type="submit" aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)] text-white"><I.arrow className="h-4 w-4" /></button></form>
    </div>
  );
}

const JOURNEY = [
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>, n: "1. Login", s: "Sign in with PayPal (OIDC)", href: "/" },
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M12 3l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 17l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>, n: "2. Import", s: "Auto-detect & parse rewards", href: "/wallet" },
  { icon: (c: string) => <I.sparkle className={c} />, n: "3. Plan", s: "Find best deals with AI + Channel3", href: "/shop" },
  { icon: (c: string) => <I.mandate className={c} />, n: "4. Mandate", s: "Grant a secure Vault mandate", href: "/mandate" },
  { icon: (c: string) => <I.shop className={c} />, n: "5. Pay", s: "Agent pays within your policy", href: "/shop" },
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M4 10h16M6 10V7h12v3M5 10l1 10h12l1-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 13v4M10 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>, n: "6. Cash out", s: "Liberate rewards via PayPal Payouts", href: "/rescue" },
  { icon: (c: string) => <I.insights className={c} />, n: "7. Track", s: "Receipts, refunds & insights", href: "/insights" },
];
function JourneyStrip() {
  return (
    <section className="mt-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.insights className="h-5 w-5" /></span><h2 className="text-[18px] font-semibold text-[var(--color-fg)]">The <span className="text-[var(--color-brand)]">RePal journey</span>: end to end</h2><span className="ml-auto flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)]"><Mark className="h-5 w-5" /> Powered by <b className="text-[var(--color-fg)]">PayPal</b></span></div>
      <div className="relative grid grid-cols-2 gap-y-7 sm:grid-cols-4 lg:grid-cols-7">
        {JOURNEY.map((j, i) => (
          <Link key={j.n} href={j.href} className="group relative flex flex-col items-center px-2 text-center">
            {i < JOURNEY.length - 1 && <span aria-hidden className="absolute left-1/2 top-7 hidden h-px w-full bg-[var(--color-border)] lg:block" />}
            <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-brand)] transition-transform group-hover:-translate-y-0.5">{j.icon("h-6 w-6")}<span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"><I.check className="h-3 w-3" /></span></span>
            <div className="mt-2.5 text-[13px] font-semibold text-[var(--color-fg)]">{j.n}</div><div className="mt-0.5 text-[11.5px] leading-tight text-[var(--color-muted)]">{j.s}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const FILTERS = [
  { key: "all", label: "All Rewards", test: () => true },
  { key: "giftcard", label: "Gift Cards", test: (t: string) => t === "giftcard" || t === "gift_card" },
  { key: "credit", label: "Store Credits", test: (t: string) => t === "credit" },
  { key: "cashback", label: "Cashback", test: (t: string) => t === "cashback" },
  { key: "coupon", label: "Coupons", test: (t: string) => t === "coupon" },
  { key: "points", label: "Points", test: (t: string) => t === "points" },
];

/** The pivotal journey step: authorize the agent (set a signed spending mandate)
 *  before it can transact. Shown to every user — PayPal or judge — until set. */
function MandateGate({ mandate, loading }: { mandate: { capUsd: number; approvalThresholdUsd: number; paypalVaultTokenId?: string | null } | null | undefined; loading: boolean }) {
  if (loading) return null;
  if (mandate) {
    // A mandate is a signed spending POLICY. Hands-free auto-pay additionally
    // needs a connected PayPal funding source (a Vault token). Report the two
    // states honestly instead of implying the agent can charge when it can't.
    const funded = Boolean(mandate.paypalVaultTokenId);
    return funded ? (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><I.shield className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-[var(--color-fg)]">Agent authorized — hands-free pay enabled</div>
          <div className="text-[12.5px] text-[var(--color-muted)]">PayPal funding connected · per-purchase cap {usd(mandate.capUsd)} · asks you above {usd(mandate.approvalThresholdUsd)} · revocable anytime.</div>
        </div>
        <Link href="/mandate" className="shrink-0 rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5">Manage →</Link>
      </div>
    ) : (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><I.shield className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-[var(--color-fg)]">Agent authorized — policy set, no funding connected yet</div>
          <div className="text-[12.5px] text-[var(--color-muted)]">Spending limits are active (cap {usd(mandate.capUsd)} · asks above {usd(mandate.approvalThresholdUsd)}). Connect PayPal funding to let the agent pay hands-free; until then it prepares the payment for you to approve.</div>
        </div>
        <Link href="/mandate?vault=1" className="shrink-0 rounded-xl bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white hover:-translate-y-0.5 transition-transform">Connect funding →</Link>
      </div>
    );
  }
  return (
    <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--color-brand)]/30 bg-gradient-to-br from-[var(--color-brand)]/[0.08] to-transparent p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/12 px-3 py-1 text-[12px] font-semibold text-[var(--color-brand)]"><I.shield className="h-3.5 w-3.5" />Step 1 · Authorize your agent</span>
          <h2 className="mt-3 text-[20px] font-bold leading-tight tracking-tight text-[var(--color-fg)]">Set a spending mandate so your agent can pay for you.</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">RePal&apos;s AI reads your rewards and finds the lowest price — but it only moves money once you grant a signed, PayPal-backed mandate. You set the limits; nothing transacts outside your policy, and you can revoke anytime.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)]/12 text-[11px] font-bold text-[var(--color-brand)]">1</span>Set per-purchase + budget limits</span>
            <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)]/12 text-[11px] font-bold text-[var(--color-brand)]">2</span>Authorize with PayPal</span>
            <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)]/12 text-[11px] font-bold text-[var(--color-brand)]">3</span>Agent transacts within policy</span>
          </div>
        </div>
        <Link href="/mandate" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--color-brand)] px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">Set up my agent <I.arrow className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}

export function WalletDashboard() {
  const qc = useQueryClient();
  const { me, name } = useShellUser();
  const userId = me?.userId ?? "demo-user";
  const { data: rewards, isLoading } = useQuery({ queryKey: ["wallet", userId], queryFn: () => fetchWallet(userId) });
  const { data: insights } = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, retry: false });
  const { data: mandate, isLoading: mandateLoading } = useQuery({ queryKey: ["mandate"], queryFn: fetchMandate, retry: false });
  const sync = useMutation({ mutationFn: () => ingestWallet(userId), onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", userId] }) });
  const [filter, setFilter] = useState("all");

  const list = rewards ?? [];
  const sums = useMemo(() => {
    const by = (pred: (t: string) => boolean) => list.filter((r) => pred(r.type)).reduce((s, r) => s + r.valueUsd, 0);
    return { total: list.reduce((s, r) => s + r.valueUsd, 0), count: list.length, cashback: by((t) => t === "cashback"), credit: by((t) => t === "credit"), coupon: by((t) => t === "coupon") };
  }, [list]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const f of FILTERS) c[f.key] = list.filter((r) => f.test(r.type)).length; return c; }, [list]);
  const shown = list.filter((r) => FILTERS.find((f) => f.key === filter)!.test(r.type));

  return (
    <DashboardShell title={<>{greeting()}, {name} <span className="align-middle">👋</span></>} subtitle="Your rewards, optimized and unlocked with PayPal.">
      {/* Step 1 of the journey: authorize the agent (set the mandate) */}
      <MandateGate mandate={mandate} loading={mandateLoading} />

      {/* hero (card-proportioned) + agent — items-start keeps the hero compact */}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <div className="relative isolate aspect-[1.75/1] overflow-hidden rounded-[24px] p-6 text-white shadow-[0_20px_55px_-28px_rgba(60,40,200,.6)] sm:aspect-auto" style={{ background: "linear-gradient(135deg,#4b1fb0 0%,#3a2fc6 46%,#1f3a8f 100%)" }}>
          <div aria-hidden className="pointer-events-none absolute -right-6 top-0 h-full w-2/3" style={{ background: "radial-gradient(60% 60% at 75% 25%, rgba(255,255,255,.2), transparent 70%)" }} />
          {/* faded RP monogram, lower-left watermark */}
          <Image aria-hidden src="/brand/repal-monogram.png" alt="" width={260} height={260} className="pointer-events-none absolute -bottom-8 -left-7 h-52 w-52 opacity-[0.22] mix-blend-screen" />
          {/* small decorative PayPal card, upper-right */}
          <div aria-hidden className="pointer-events-none absolute -right-2 top-5 hidden h-24 w-40 rotate-[10deg] rounded-2xl bg-white/10 ring-1 ring-white/20 sm:block"><span className="grid h-full place-items-center text-3xl font-bold italic text-white/40">P</span></div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20"><Mark className="h-5 w-5" /></span><span className="text-[15px] font-semibold">Reward Wallet</span></div>
            <button onClick={() => sync.mutate()} disabled={sync.isPending} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 disabled:opacity-60"><svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`}><path d="M20 11a8 8 0 1 0-1.6 4.9M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{sync.isPending ? "Syncing…" : "Sync"}</button>
          </div>
          <div className="relative mt-3">
            <div className="tnum text-[38px] font-bold leading-none tracking-tight">{isLoading ? "—" : usd(sums.total)}</div>
            <div className="mt-2 text-[13.5px] text-white/80">Total reward value · {sums.count} reward{sums.count === 1 ? "" : "s"}</div>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[12px] font-medium text-emerald-100 ring-1 ring-emerald-300/30"><I.check className="h-3.5 w-3.5" />Auto-imported & AI-parsed</span>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-x-5 gap-y-3.5">
            <Stat icon={<I.gift className="h-5 w-5" />} value={String(sums.count)} label="Active rewards" />
            <Stat icon={<I.coin className="h-5 w-5" />} value={usd(sums.cashback)} label="Cashback value" />
            <Stat icon={<I.store className="h-5 w-5" />} value={usd(sums.credit)} label="Store credits" />
            <Stat icon={<I.tag className="h-5 w-5" />} value={usd(sums.coupon)} label="Coupons" />
          </div>
        </div>
        <AgentPanel />
      </div>

      <div className="mt-5"><ConnectGmail /></div>

      <div className="mt-5"><PaymentMethods /></div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => { const active = filter === f.key; const n = counts[f.key] ?? 0; if (f.key !== "all" && n === 0) return null;
          return <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${active ? "bg-[var(--color-brand)] text-white shadow-sm" : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}>{f.label} ({n})</button>;
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)]" />)}</div>
          ) : shown.length === 0 ? (
            <div className="grid place-items-center rounded-[22px] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center text-sm text-[var(--color-muted)]">No rewards here yet — hit <b className="mx-1 text-[var(--color-fg)]">Sync</b> to import.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">{shown.map((r, i) => <RewardCardV2 key={r.id} reward={r} index={i} defaultEmail={me?.email} onCashedOut={() => qc.invalidateQueries({ queryKey: ["wallet", userId] })} />)}</div>
          )}
        </div>
        <aside className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[var(--color-fg)]">Recent activity</h3><Link href="/insights" className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-brand)]">See all <I.arrow className="h-3.5 w-3.5" /></Link></div>
          <ul className="mt-4 flex flex-col gap-4">
            {(insights?.recent ?? []).slice(0, 5).map((a) => (
              <li key={a.id} className="flex gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-600"><I.check className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><span className="truncate text-[13.5px] font-semibold text-[var(--color-fg)]">Payment completed</span><span className="shrink-0 text-[11.5px] text-[var(--color-muted)]">{timeAgo(a.createdAt)}</span></div><div className="truncate text-[12.5px] text-[var(--color-muted)]">{usd(a.cashUsd)} · {a.merchant}{a.savedUsd > 0 ? ` · saved ${usd(a.savedUsd)}` : ""}</div></div></li>
            ))}
            {(!insights || insights.recent.length === 0) && <li className="text-[13px] text-[var(--color-muted)]">No activity yet. Pay with your wallet to see signed receipts here.</li>}
          </ul>
        </aside>
      </div>

      <JourneyStrip />
    </DashboardShell>
  );
}
