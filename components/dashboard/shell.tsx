"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { fetchWallet, fetchMe, fetchInsights, logout, type WalletReward } from "@/lib/client";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ─────────────────── shared helpers ─────────────────── */
export const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function intentRoute(router: ReturnType<typeof useRouter>, text: string) {
  const t = text.toLowerCase().trim(); if (!t) return;
  if (/cash ?out|expir|rescue|redeem/.test(t)) return router.push("/rescue");
  if (/mandate|limit|budget|\bcap\b|approval|policy/.test(t)) return router.push("/mandate");
  if (/insight|spent|saving|saved|receipt|report|history/.test(t)) return router.push("/insights");
  const q = t.replace(/^(buy|shop(?: for)?|find|get|order|purchase|search(?: for)?)\s+/i, "");
  return router.push(`/shop?q=${encodeURIComponent(q || text)}`);
}

/* ─────────────────── icons ─────────────────── */
type IconProps = { className?: string };
export const I = {
  home: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  shop: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M5 7h14l-1 13H6L5 7zM9 7a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  wallet: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M16 12h3M3 9.5h13a2 2 0 0 1 2 2V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  mandate: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  insights: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  settings: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  help: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3 1-1.3 1.9M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  bell: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  sparkle: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3z" fill="currentColor" /></svg>,
  arrow: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  menu: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  chevron: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  search: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  x: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  logout: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M15 12H4M9 7l-5 5 5 5M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  gift: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="9" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" /><path d="M3 13h18M12 9v12M8.5 9A2.5 2.5 0 1 1 12 6a2.5 2.5 0 1 1 3.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  coin: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="2" /><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="2" /></svg>,
  tag: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 11.5V4h7.5L21 14.5 14.5 21 3 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg>,
  store: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 9l1-5h14l1 5M4 9h16M4 9v10h16V9M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  cart: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 4h2l2.2 11.3a1 1 0 0 0 1 .7h8.4a1 1 0 0 0 1-.8L20 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="20" r="1.4" fill="currentColor" /><circle cx="18" cy="20" r="1.4" fill="currentColor" /></svg>,
  scale: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 6 0L10 7M19 7l-2.5 6a3 3 0 0 0 6 0L20 7M8 5l8-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  bolt: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  shield: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  check: (p: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};
export const Mark = ({ className = "" }: { className?: string }) => <Image src="/brand/repal-monogram.png" alt="" width={28} height={28} className={className} />;

const NAV = [
  { href: "/", label: "Home", icon: I.home, match: (p: string) => p === "/" },
  { href: "/shop", label: "Shop", icon: I.shop, match: (p: string) => p.startsWith("/shop") },
  { href: "/wallet", label: "Wallet", icon: I.wallet, match: (p: string) => p.startsWith("/wallet") },
  { href: "/mandate", label: "Mandate", icon: I.mandate, match: (p: string) => p.startsWith("/mandate") },
  { href: "/insights", label: "Insights", icon: I.insights, match: (p: string) => p.startsWith("/insights") },
];

/* ─────────────────── sidebar ─────────────────── */
function SidebarInner({ name, connected, collapsed, onToggle, onNavigate }: {
  name: string; connected: boolean; collapsed: boolean; onToggle?: () => void; onNavigate?: () => void;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const doLogout = async () => { try { await logout(); } finally { window.location.href = "/"; } };
  const item = (href: string, label: string, Icon: (p: IconProps) => React.ReactNode, active: boolean) => (
    <Link key={href + label} href={href} onClick={onNavigate} title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${active ? "bg-[var(--color-brand)] text-white shadow-sm" : "text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]"}`}>
      <Icon className="h-5 w-5 shrink-0" />{!collapsed && label}
    </Link>
  );
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between"} px-1`}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2"><Mark className="h-7 w-7" />{!collapsed && <span className="text-lg font-bold tracking-tight text-[var(--color-fg)]">Re<span className="text-[var(--color-brand)]">Pal</span></span>}</Link>
        {onToggle && !collapsed && <button onClick={onToggle} aria-label="Collapse sidebar" className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]"><I.chevron className="h-4 w-4" /></button>}
      </div>
      {onToggle && collapsed && <button onClick={onToggle} aria-label="Expand sidebar" className="mb-3 grid h-9 place-items-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-brand)]/8 hover:text-[var(--color-fg)]"><I.chevron className="h-4 w-4 rotate-180" /></button>}
      <nav className="flex flex-col gap-1">{NAV.map((n) => item(n.href, n.label, n.icon, n.match(path)))}</nav>
      <div className="mt-auto flex flex-col gap-1">
        {item("/mandate", "Settings", I.settings, false)}
        {item("/privacy", "Help", I.help, false)}
        <div className="relative mt-2">
          <button onClick={() => setMenu((m) => !m)} title={collapsed ? name : undefined} className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 hover:bg-[var(--color-brand)]/8 ${collapsed ? "justify-center" : ""}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-sm font-semibold text-white">{name.charAt(0).toUpperCase()}</span>
            {!collapsed && <div className="min-w-0 text-left"><div className="truncate text-sm font-semibold text-[var(--color-fg)]">{name}</div><div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]"><span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />{connected ? "PayPal Connected" : "Guest"}</div></div>}
          </button>
          {menu && <div className="absolute bottom-full left-0 mb-2 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg"><Link href="/mandate" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-brand)]/8"><I.settings className="h-4 w-4" />Spending mandate</Link><button onClick={doLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/8"><I.logout className="h-4 w-4" />Log out</button></div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── command palette ─────────────────── */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  if (!open) return null;
  const go = (fn: () => void) => { fn(); onClose(); };
  const quick = [
    { label: "Shop for a product", sub: "Find the cheapest price after rewards", go: () => router.push("/shop") },
    { label: "Rescue expiring rewards", sub: "Cash out before they vanish", go: () => router.push("/rescue") },
    { label: "Set your spending mandate", sub: "Your agent's limits", go: () => router.push("/mandate") },
    { label: "View insights", sub: "Every dollar, verifiable", go: () => router.push("/insights") },
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(() => intentRoute(router, q)); }} className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
          <I.sparkle className="h-5 w-5 text-[var(--color-brand)]" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask RePal — e.g. “Sony headphones under $250”, “cash out expiring”…" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)]" />
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-bg)]"><I.x className="h-4 w-4" /></button>
        </form>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {q.trim() && <button onClick={() => go(() => intentRoute(router, q))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--color-brand)]/8"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.search className="h-4 w-4" /></span><span className="text-sm"><b className="text-[var(--color-fg)]">Search “{q}”</b><span className="block text-[12px] text-[var(--color-muted)]">RePal routes you to the right place</span></span></button>}
          <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Quick actions</div>
          {quick.map((a) => <button key={a.label} onClick={() => go(a.go)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--color-brand)]/8"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.arrow className="h-4 w-4" /></span><span className="text-sm"><b className="text-[var(--color-fg)]">{a.label}</b><span className="block text-[12px] text-[var(--color-muted)]">{a.sub}</span></span></button>)}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── notifications ─────────────────── */
function NotificationsBell({ expiring, recent }: { expiring: WalletReward[]; recent: { id: string; merchant: string; cashUsd: number; createdAt: string }[] }) {
  const [open, setOpen] = useState(false);
  const count = expiring.length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-sm hover:text-[var(--color-fg)]"><I.bell className="h-5 w-5" />{count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count}</span>}</button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"><div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3"><span className="text-sm font-semibold text-[var(--color-fg)]">Notifications</span><Link href="/rescue" onClick={() => setOpen(false)} className="text-[12px] font-medium text-[var(--color-brand)]">Rescue →</Link></div><div className="max-h-80 overflow-y-auto p-2">{count === 0 && recent.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-[var(--color-muted)]">You&apos;re all caught up ✨</p>}{expiring.map((r) => { const d = daysLeft(r.expiresAt); return <Link key={r.id} href="/rescue" onClick={() => setOpen(false)} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--color-bg)]"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-600">⏰</span><div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-[var(--color-fg)]">Reward expiring soon</div><div className="truncate text-[12px] text-[var(--color-muted)]">{r.termsRaw.slice(0, 48)}… · {d <= 0 ? "today" : `${d}d left`}</div></div></Link>; })}{recent.slice(0, 3).map((a) => <div key={a.id} className="flex gap-3 rounded-xl px-3 py-2.5"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-600">✓</span><div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-[var(--color-fg)]">Payment completed</div><div className="truncate text-[12px] text-[var(--color-muted)]">{usd(a.cashUsd)} · {a.merchant} · {timeAgo(a.createdAt)}</div></div></div>)}</div></div></>}
    </div>
  );
}

/* ─────────────────── shell ─────────────────── */
export function useShellUser() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const name = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0] ?? "there";
  return { me, name, connected: Boolean(me) };
}

export function DashboardShell({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  const { me, name, connected } = useShellUser();
  const userId = me?.userId ?? "demo-user";
  const { data: rewards } = useQuery({ queryKey: ["wallet", userId], queryFn: () => fetchWallet(userId) });
  const { data: insights } = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, retry: false });

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("repal_sidebar") === "1"); } catch {} }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("repal_sidebar", c ? "0" : "1"); } catch {} return !c; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const list = rewards ?? [];
  const expiring = useMemo(() => list.filter((r) => r.status === "active" && daysLeft(r.expiresAt) >= 0 && daysLeft(r.expiresAt) <= 7).sort((a, b) => daysLeft(a.expiresAt) - daysLeft(b.expiresAt)), [list]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]">
      <aside className={`hidden shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)]/70 backdrop-blur-sm transition-[width] duration-300 ease-out lg:block ${collapsed ? "w-[74px]" : "w-[232px]"}`}>
        <SidebarInner name={name} connected={connected} collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>
      <div className={`fixed inset-0 z-[60] lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setMobileOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 w-[232px] border-r border-[var(--color-border)] bg-[var(--color-card)] transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}><SidebarInner name={name} connected={connected} collapsed={false} onNavigate={() => setMobileOpen(false)} /></aside>
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 lg:px-9">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] lg:hidden"><I.menu className="h-5 w-5" /></button>
            <div><h1 className="text-[25px] font-bold tracking-tight text-[var(--color-fg)]">{title}</h1>{subtitle && <p className="mt-1 text-[14.5px] text-[var(--color-muted)]">{subtitle}</p>}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPaletteOpen(true)} className="hidden items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-muted)] shadow-sm transition-colors hover:border-[var(--color-brand)]/40 sm:flex"><I.sparkle className="h-4 w-4 text-[var(--color-brand)]" /><span>Ask RePal anything…</span><kbd className="ml-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px]">⌘K</kbd></button>
            <button onClick={() => setPaletteOpen(true)} aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-sm sm:hidden"><I.search className="h-5 w-5" /></button>
            <ThemeToggle />
            <NotificationsBell expiring={expiring} recent={insights?.recent ?? []} />
          </div>
        </header>
        {children}
        <div className="h-4" />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
