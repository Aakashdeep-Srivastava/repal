"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { fetchWallet, fetchMe, ingestWallet, fetchInsights } from "@/lib/client";
import { RewardCardV2 } from "@/components/wallet/RewardCardV2";
import { ConnectGmail } from "@/components/wallet/ConnectGmail";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ─────────────────────────── helpers ─────────────────────────── */

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ─────────────────────────── icons ─────────────────────────── */

type IconProps = { className?: string };
const I = {
  home: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  agent: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l1.6 3.9L17.5 8l-3 2.8.7 4.2L12 13l-3.2 2 .7-4.2L6.5 8l3.9-1.1L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  shop: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M5 7h14l-1 13H6L5 7zM9 7a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  wallet: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M16 12h3M3 9.5h13a2 2 0 0 1 2 2V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  mandate: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  insights: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  settings: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  help: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3 1-1.3 1.9M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  bell: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  sparkle: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3zM19 14l.7 2 .3 2 2-.3 2 .7-2 .7-2 .3.3 2-.7 2-.7-2-.3-2-2 .3-2-.7 2-.7 2-.3-.3-2 .7-2z" fill="currentColor" opacity=".9" /></svg>,
  gift: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="9" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" /><path d="M3 13h18M12 9v12M8.5 9A2.5 2.5 0 1 1 12 6a2.5 2.5 0 1 1 3.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  coin: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="2" /><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="2" /></svg>,
  tag: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 11.5V4h7.5L21 14.5 14.5 21 3 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg>,
  store: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 9l1-5h14l1 5M4 9h16M4 9v10h16V9M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  arrow: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const PayPalMark = ({ className = "" }: { className?: string }) => (
  <Image src="/brand/repal-monogram.png" alt="" width={28} height={28} className={className} />
);

/* ─────────────────────────── sidebar ─────────────────────────── */

const NAV = [
  { href: "/", label: "Home", icon: I.home, match: (p: string) => p === "/" },
  { href: "/shop", label: "Shop", icon: I.shop, match: (p: string) => p.startsWith("/shop") },
  { href: "/wallet", label: "Wallet", icon: I.wallet, match: (p: string) => p.startsWith("/wallet") },
  { href: "/mandate", label: "Mandate", icon: I.mandate, match: (p: string) => p.startsWith("/mandate") },
  { href: "/insights", label: "Insights", icon: I.insights, match: (p: string) => p.startsWith("/insights") },
];

function Sidebar({ name, connected }: { name: string; connected: boolean }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/70 px-4 py-6 backdrop-blur-sm lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <PayPalMark className="h-7 w-7" />
        <span className="text-lg font-bold tracking-tight text-[var(--color-fg)]">Re<span className="text-[var(--color-brand)]">Pal</span></span>
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const active = n.match(path);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[var(--color-brand)] text-white shadow-sm" : "text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]"}`}>
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]">
          <I.settings className="h-5 w-5" /> Settings
        </button>
        <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]">
          <I.help className="h-5 w-5" /> Help
        </button>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-brand)] text-sm font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--color-fg)]">{name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {connected ? "PayPal Connected" : "Not connected"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────── stat tile ─────────────────────────── */

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">{icon}</span>
      <div className="min-w-0">
        <div className="tnum text-[17px] font-semibold leading-none text-white">{value}</div>
        <div className="mt-1 truncate text-[12px] text-white/70">{label}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── agent panel ─────────────────────────── */

function AgentPanel() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const chips: { label: string; go: () => void }[] = [
    { label: "Buy Nike shoes under $120", go: () => router.push("/shop?q=nike+shoes") },
    { label: "Cash out my expiring rewards", go: () => router.push("/rescue") },
    { label: "Show rewards expiring this week", go: () => router.push("/rescue") },
  ];
  return (
    <div className="flex flex-col rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.sparkle className="h-5 w-5" /></span>
        <span className="text-[17px] font-semibold text-[var(--color-fg)]">RePal Agent</span>
        <span className="ml-auto rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand)]">Powered by AI</span>
      </div>
      <p className="mt-4 text-[15px] text-[var(--color-fg)]">
        Tell me what you want to buy <span className="font-semibold">or save on.</span>
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {chips.map((c) => (
          <button key={c.label} onClick={c.go}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-left text-[13.5px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><I.sparkle className="h-4 w-4" /></span>
            {c.label}
          </button>
        ))}
        <button onClick={() => router.push("/")} className="px-1.5 text-left text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-brand)]">
          ··· More examples
        </button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/?goal=${encodeURIComponent(goal)}`); }}
        className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-4 pr-1.5">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Type a goal…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]" />
        <button type="submit" aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)] text-white">
          <I.arrow className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────── journey strip ─────────────────────────── */

const JOURNEY = [
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>, n: "1. Login", s: "Sign in with PayPal (OIDC)" },
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M12 3l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 17l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>, n: "2. Import", s: "Auto-detect & parse rewards" },
  { icon: (c: string) => <I.sparkle className={c} />, n: "3. Plan", s: "Find best deals with AI + Channel3" },
  { icon: (c: string) => <I.mandate className={c} />, n: "4. Mandate", s: "Grant a secure Vault mandate" },
  { icon: (c: string) => <I.shop className={c} />, n: "5. Pay", s: "Agent pays within your policy" },
  { icon: (c: string) => <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M4 10h16M6 10V7h12v3M5 10l1 10h12l1-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 13v4M10 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>, n: "6. Cash out", s: "Liberate rewards via PayPal Payouts" },
  { icon: (c: string) => <I.insights className={c} />, n: "7. Track", s: "Receipts, refunds & insights" },
];

function JourneyStrip() {
  return (
    <section className="mt-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.insights className="h-5 w-5" /></span>
        <h2 className="text-[18px] font-semibold text-[var(--color-fg)]">The <span className="text-[var(--color-brand)]">RePal journey</span>: end to end</h2>
        <span className="ml-auto flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)]">
          <PayPalMark className="h-5 w-5" /> Powered by <b className="text-[var(--color-fg)]">PayPal</b>
        </span>
      </div>
      <div className="relative grid grid-cols-2 gap-y-7 sm:grid-cols-4 lg:grid-cols-7">
        {JOURNEY.map((j, i) => (
          <div key={j.n} className="relative flex flex-col items-center px-2 text-center">
            {i < JOURNEY.length - 1 && <span aria-hidden className="absolute left-1/2 top-7 hidden h-px w-full bg-[var(--color-border)] lg:block" />}
            <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-brand)]">
              {j.icon("h-6 w-6")}
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3"><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </span>
            <div className="mt-2.5 text-[13px] font-semibold text-[var(--color-fg)]">{j.n}</div>
            <div className="mt-0.5 text-[11.5px] leading-tight text-[var(--color-muted)]">{j.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── dashboard ─────────────────────────── */

const FILTERS = [
  { key: "all", label: "All Rewards", test: () => true },
  { key: "giftcard", label: "Gift Cards", test: (t: string) => t === "giftcard" || t === "gift_card" },
  { key: "credit", label: "Store Credits", test: (t: string) => t === "credit" },
  { key: "cashback", label: "Cashback", test: (t: string) => t === "cashback" },
  { key: "coupon", label: "Coupons", test: (t: string) => t === "coupon" },
  { key: "points", label: "Points", test: (t: string) => t === "points" },
];

export function WalletDashboard() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const userId = me?.userId ?? "demo-user";
  const name = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0] ?? "there";
  const { data: rewards, isLoading } = useQuery({ queryKey: ["wallet", userId], queryFn: () => fetchWallet(userId) });
  const { data: insights } = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, retry: false });
  const sync = useMutation({ mutationFn: () => ingestWallet(userId), onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", userId] }) });

  const [filter, setFilter] = useState("all");

  const list = rewards ?? [];
  const sums = useMemo(() => {
    const by = (pred: (t: string) => boolean) => list.filter((r) => pred(r.type)).reduce((s, r) => s + r.valueUsd, 0);
    return {
      total: list.reduce((s, r) => s + r.valueUsd, 0),
      count: list.length,
      cashback: by((t) => t === "cashback"),
      credit: by((t) => t === "credit"),
      coupon: by((t) => t === "coupon"),
    };
  }, [list]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.key] = list.filter((r) => f.test(r.type)).length;
    return c;
  }, [list]);

  const shown = list.filter((r) => FILTERS.find((f) => f.key === filter)!.test(r.type));

  return (
    <div className="flex min-h-dvh bg-[var(--color-bg)]">
      <Sidebar name={name} connected={Boolean(me)} />

      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
        {/* header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--color-fg)]">
              {greeting()}, {name} <span className="align-middle">👋</span>
            </h1>
            <p className="mt-1 text-[15px] text-[var(--color-muted)]">Your rewards, optimized and unlocked with PayPal.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-muted)] shadow-sm sm:flex">
              <I.sparkle className="h-4 w-4 text-[var(--color-brand)]" />
              <span>Ask RePal anything…</span>
              <kbd className="ml-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px]">⌘K</kbd>
            </div>
            <ThemeToggle />
            <button aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-sm">
              <I.bell className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* hero + agent */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* gradient wallet hero */}
          <div className="relative overflow-hidden rounded-[26px] p-7 text-white shadow-[0_20px_60px_-25px_rgba(60,40,200,.6)] lg:col-span-2"
            style={{ background: "linear-gradient(135deg,#4b1fb0 0%,#3a2fc6 46%,#1f3a8f 100%)" }}>
            <div aria-hidden className="pointer-events-none absolute -right-10 top-0 h-full w-1/2"
              style={{ background: "radial-gradient(60% 60% at 70% 30%, rgba(255,255,255,.22), transparent 70%)" }} />
            {/* decorative stacked cards */}
            <div aria-hidden className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 sm:block">
              <div className="h-36 w-56 rotate-[8deg] rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm" />
              <div className="absolute left-6 top-4 grid h-36 w-56 rotate-[-4deg] place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <span className="text-5xl font-bold italic text-white/80">P</span>
              </div>
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20"><PayPalMark className="h-5 w-5" /></span>
                <span className="text-[15px] font-semibold">Reward Wallet</span>
              </div>
              <button onClick={() => sync.mutate()} disabled={sync.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 disabled:opacity-60">
                <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`}><path d="M20 11a8 8 0 1 0-1.6 4.9M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {sync.isPending ? "Syncing…" : "Sync rewards"}
              </button>
            </div>

            <div className="relative mt-5">
              <div className="tnum text-[46px] font-bold leading-none tracking-tight">{isLoading ? "—" : usd(sums.total)}</div>
              <div className="mt-2 text-[15px] text-white/80">Total reward value across {sums.count} reward{sums.count === 1 ? "" : "s"}</div>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[12.5px] font-medium text-emerald-100 ring-1 ring-emerald-300/30">
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5"><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Auto-imported & AI-parsed
              </span>
            </div>

            <div className="relative mt-7 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Stat icon={<I.gift className="h-5 w-5" />} value={String(sums.count)} label="Active rewards" />
              <Stat icon={<I.coin className="h-5 w-5" />} value={usd(sums.cashback)} label="Cashback value" />
              <Stat icon={<I.store className="h-5 w-5" />} value={usd(sums.credit)} label="Store credits" />
              <Stat icon={<I.tag className="h-5 w-5" />} value={usd(sums.coupon)} label="Coupons" />
            </div>
          </div>

          <AgentPanel />
        </div>

        {/* gmail connect (dormant unless configured) */}
        <div className="mt-5"><ConnectGmail /></div>

        {/* filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key] ?? 0;
            if (f.key !== "all" && n === 0) return null;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${active ? "bg-[var(--color-brand)] text-white shadow-sm" : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}>
                {f.label} ({n})
              </button>
            );
          })}
        </div>

        {/* rewards grid + activity */}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)]" />)}
              </div>
            ) : shown.length === 0 ? (
              <div className="grid place-items-center rounded-[22px] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center text-sm text-[var(--color-muted)]">
                No rewards here yet — hit <b className="mx-1 text-[var(--color-fg)]">Sync rewards</b> to import.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {shown.map((r, i) => (
                  <RewardCardV2 key={r.id} reward={r} index={i} defaultEmail={me?.email}
                    onCashedOut={() => qc.invalidateQueries({ queryKey: ["wallet", userId] })} />
                ))}
              </div>
            )}
          </div>

          {/* recent activity */}
          <aside className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--color-fg)]">Recent activity</h3>
              <Link href="/insights" className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-brand)]">See all <I.arrow className="h-3.5 w-3.5" /></Link>
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {(insights?.recent ?? []).slice(0, 4).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-600">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-[var(--color-fg)]">Payment completed</span>
                      <span className="shrink-0 text-[11.5px] text-[var(--color-muted)]">{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-[var(--color-muted)]">{usd(a.cashUsd)} · {a.merchant}{a.savedUsd > 0 ? ` · saved ${usd(a.savedUsd)}` : ""}</div>
                  </div>
                </li>
              ))}
              {(!insights || insights.recent.length === 0) && (
                <li className="text-[13px] text-[var(--color-muted)]">No activity yet. Pay with your wallet to see signed receipts here.</li>
              )}
            </ul>
          </aside>
        </div>

        <JourneyStrip />
      </main>
    </div>
  );
}
