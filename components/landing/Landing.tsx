"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { judgeLogin } from "@/lib/client";
import { ThemeToggle } from "@/components/ThemeToggle";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ── icons ── */
type IP = { className?: string };
const Ic = {
  spark: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3z" fill="currentColor" /></svg>,
  play: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" /></svg>,
  shield: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  bolt: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  stack: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  check: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M8.5 12l2.5 2.5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  gift: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="9" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" /><path d="M3 13h18M12 9v12M8.5 9A2.5 2.5 0 1 1 12 6a2.5 2.5 0 1 1 3.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  pct: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="2" /><circle cx="16.5" cy="16.5" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>,
  coin: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="2" /><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="2" /></svg>,
  cashback: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M20 11a8 8 0 1 0-1.6 4.9M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  cart: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 4h2l2.2 11.3a1 1 0 0 0 1 .7h8.4a1 1 0 0 0 1-.8L20 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="20" r="1.4" fill="currentColor" /><circle cx="18" cy="20" r="1.4" fill="currentColor" /></svg>,
  wallet: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M16 12h3M3 9.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  doc: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 3h8l4 4v14H6V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="11" cy="13" r="2.5" stroke="currentColor" strokeWidth="2" /><path d="M13 15l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  tag: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M3 11.5V4h7.5L21 14.5 14.5 21 3 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg>,
  card: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M3 9h18" stroke="currentColor" strokeWidth="2" /></svg>,
  arrowD: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  bag: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 8h12l-1 12H7L6 8zM9 8a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  store: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M4 9l1-5h14l1 5M4 9h16M4 9v10h16V9M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  receipt: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
};

const GRAD = "linear-gradient(100deg,#7c3aed 0%,#5b4be6 45%,#2457e6 100%)";
const Mark = ({ className = "" }: { className?: string }) => <Image src="/brand/repal-monogram.png" alt="RePal" width={32} height={32} className={className} />;
const Pill = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/80 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-wide text-[#6d28d9] shadow-sm backdrop-blur"><Ic.spark className="h-3.5 w-3.5" />{children}</span>;

function Chip({ icon, label, value, cls = "" }: { icon: React.ReactNode; label: string; value: string; cls?: string }) {
  return (
    <div className={`flow-chip flex items-center gap-2.5 rounded-2xl border border-white/60 bg-white/80 px-3.5 py-2.5 shadow-[0_10px_30px_-14px_rgba(80,40,200,.4)] backdrop-blur ${cls}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#7c3aed]/10 text-[#7c3aed]">{icon}</span>
      <div className="leading-tight"><div className="text-[11px] font-medium text-slate-500">{label}</div><div className="text-[14px] font-bold text-slate-800">{value}</div></div>
    </div>
  );
}

export function Landing() {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const demo = useMutation({ mutationFn: judgeLogin, onSuccess: () => router.push("/wallet") });

  useGSAP(() => {
    const mm = gsap.matchMedia();

    // hero intro (on load)
    gsap.from(".hero-in", { opacity: 0, y: 24, duration: 0.8, stagger: 0.12, ease: "power3.out" });

    // section reveals on scroll
    gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
      gsap.from(el, { opacity: 0, y: 48, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });

    // PINNED FLOW — only on desktop (pin can be janky on small screens)
    mm.add("(min-width: 1024px)", () => {
      gsap.set(".flow-chip", { opacity: 0, x: -36 });
      gsap.set(".flow-best", { opacity: 0, scale: 0.9 });
      gsap.set(".flow-line", { strokeDashoffset: 1 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: ".flow", start: "top top", end: "+=1600", pin: true, scrub: 1 },
      });
      // 1) reward cards scroll in (stagger)
      tl.to(".flow-chip", { opacity: 1, x: 0, stagger: 0.18, ease: "power2.out" }, 0);
      // 2) input lines illuminate light-purple toward the agent
      tl.to(".flow-line-in", { strokeDashoffset: 0, stagger: 0.12, ease: "none" }, 0.25)
        .to(".flow-line-in", { opacity: 1, duration: 0.2 }, "<");
      // 3) the agent orb brightens
      tl.to(".flow-orb", { scale: 1.07, duration: 0.3 }, ">-0.1")
        .to(".flow-glow", { opacity: 0.9, duration: 0.3 }, "<");
      // 4) payment line flows GREEN out to best price
      tl.to(".flow-line-out", { strokeDashoffset: 0, opacity: 1, ease: "none" }, ">-0.05")
        .to(".flow-best", { opacity: 1, scale: 1, ease: "back.out(1.6)" }, "<0.1")
        .to(".flow-orb", { scale: 1, duration: 0.3 }, ">");
    });
  }, { scope: root });

  const NAV = [["How it Works", "#how"], ["Rewards", "#money"], ["Security", "#trust"], ["For Merchants", "#personas"], ["Resources", "#how"]];
  const trust = [["You stay in control", Ic.shield], ["Pays with PayPal", Ic.bolt], ["Stacks only valid rewards", Ic.stack], ["Verifiable receipts", Ic.check]] as const;

  const PrimaryCTA = ({ cls = "" }: { cls?: string }) => (
    <a href="/api/auth/paypal/login" className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_14px_34px_-12px_rgba(90,50,230,.7)] transition-transform hover:-translate-y-0.5 ${cls}`} style={{ background: GRAD }}><Mark className="h-5 w-5 brightness-0 invert" />Login with PayPal</a>
  );
  const DemoCTA = ({ dark = false, label = "Try Live Demo", cls = "" }: { dark?: boolean; label?: string; cls?: string }) => (
    <button onClick={() => demo.mutate()} disabled={demo.isPending} className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-[15px] font-semibold transition-colors disabled:opacity-60 ${dark ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-[#7c3aed]/40"} ${cls}`}><Ic.play className="h-5 w-5 text-[#7c3aed]" />{demo.isPending ? "Starting…" : label}</button>
  );

  return (
    <main ref={root} className="relative min-h-dvh overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#b79bff,transparent 60%)" }} />
        <div className="absolute -right-40 top-40 h-[560px] w-[560px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#8fd0ff,transparent 60%)" }} />
      </div>

      {/* NAV */}
      <header className="sticky top-4 z-50 mx-auto mt-4 flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/60 bg-[var(--color-card)]/75 px-4 py-2.5 shadow-[0_10px_30px_-18px_rgba(80,40,200,.5)] backdrop-blur-xl sm:px-5">
        <Link href="/" className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="text-lg font-bold tracking-tight">Re<span className="text-[#7c3aed]">Pal</span></span></Link>
        <nav className="hidden items-center gap-6 text-[14px] font-medium text-[var(--color-muted)] lg:flex">{NAV.map(([l, h]) => <a key={l} href={h} className="hover:text-[var(--color-fg)]">{l}</a>)}</nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => demo.mutate()} className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-[13.5px] font-semibold text-[var(--color-fg)] hover:border-[#7c3aed]/40 sm:inline-flex"><Ic.play className="h-4 w-4 text-[#7c3aed]" />Live Demo</button>
          <a href="/api/auth/paypal/login" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white" style={{ background: GRAD }}><span className="hidden sm:inline">Login with PayPal</span><span className="sm:hidden">Login</span></a>
        </div>
      </header>

      {/* HERO (text) */}
      <section className="mx-auto max-w-5xl px-5 pt-14 text-center sm:pt-20">
        <div className="hero-in flex justify-center"><Pill>Your AI Rewards Agent</Pill></div>
        <h1 className="hero-in font-display mx-auto mt-6 max-w-3xl text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[64px]">The cheapest price <em className="not-italic" style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontStyle: "italic" }}>after</em> your rewards.</h1>
        <p className="hero-in mx-auto mt-5 max-w-xl text-[16px] text-[var(--color-muted)] sm:text-[18px]">RePal reads your rewards, stacks the best offers, and pays for you with PayPal — within the limits you set.</p>
        <div className="hero-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><PrimaryCTA /><DemoCTA /></div>
        <div className="hero-in mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-medium text-[var(--color-muted)]">{trust.map(([l, I]) => <span key={l} className="inline-flex items-center gap-1.5"><I className="h-4 w-4 text-[#7c3aed]" />{l}</span>)}</div>
        <a href="#flow" className="hero-in mx-auto mt-10 grid h-9 w-9 animate-bounce place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-sm"><Ic.arrowD className="h-4 w-4" /></a>
      </section>

      {/* FLOW — pinned, illuminating lines, lavender glass-waves bg */}
      <section id="flow" className="flow relative grid min-h-dvh place-items-center overflow-hidden">
        <Image src="/bg/glass-waves.png" alt="" fill priority className="pointer-events-none absolute inset-0 -z-10 object-cover opacity-90 dark:opacity-30" />
        <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center">
          <div className="reveal mx-auto max-w-2xl"><Pill>How it flows</Pill><h2 className="font-display mt-4 text-[30px] font-bold tracking-tight text-[#1b1b4d] sm:text-[40px]">Rewards flow in. One payment flows out.</h2></div>
          <div className="relative mx-auto mt-10 h-[380px] max-w-4xl">
            <svg aria-hidden viewBox="0 0 900 380" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
              <defs><filter id="pglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              {[100, 160, 220, 280].map((y, i) => <path key={i} className="flow-line flow-line-in" d={`M250 ${y} C 360 ${y}, 380 190, 450 190`} pathLength={1} strokeDasharray={1} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" filter="url(#pglow)" opacity={0.25} />)}
              <path className="flow-line flow-line-out" d="M560 190 C 660 190, 700 190, 760 190" pathLength={1} strokeDasharray={1} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" filter="url(#pglow)" opacity={0.25} />
            </svg>
            {/* left reward cards */}
            <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
              <Chip icon={<Ic.gift className="h-4 w-4" />} label="Gift Cards" value="$50" />
              <Chip icon={<Ic.pct className="h-4 w-4" />} label="Coupons" value="$30 off" cls="ml-6" />
              <Chip icon={<Ic.coin className="h-4 w-4" />} label="Card Points" value="1,000 pts" cls="ml-6" />
              <Chip icon={<Ic.cashback className="h-4 w-4" />} label="Cashback" value="$20" />
            </div>
            {/* orb */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="flow-orb relative grid h-36 w-36 place-items-center rounded-[32px] shadow-[0_30px_70px_-20px_rgba(90,50,230,.7)]" style={{ background: GRAD }}>
                <div aria-hidden className="flow-glow absolute -inset-6 -z-10 rounded-full opacity-40 blur-2xl" style={{ background: GRAD }} />
                <Mark className="h-14 w-14 brightness-0 invert" />
              </div>
              <span className="mt-3 inline-block rounded-full bg-white/85 px-4 py-1.5 text-[13px] font-semibold text-[#1b1b4d] shadow-sm backdrop-blur">RePal Agent</span>
            </div>
            {/* best price */}
            <div className="flow-best absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-3xl border border-emerald-300/60 bg-emerald-50/90 px-7 py-5 shadow-[0_18px_40px_-18px_rgba(16,185,129,.5)] backdrop-blur lg:flex">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white"><Ic.cart className="h-5 w-5" /></span>
              <span className="text-[12px] font-semibold text-slate-600">Best Price</span>
              <span className="text-[30px] font-bold text-emerald-600">$198</span>
            </div>
          </div>
          <p className="reveal mx-auto mt-8 max-w-md text-[14px] text-[#4b4b7a]">Scroll — RePal checks each reward, lights up the valid ones, and settles the single lowest price with PayPal.</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-5 pt-24 text-center">
        <div className="reveal"><Pill>How it works</Pill><h2 className="font-display mt-4 text-[32px] font-bold tracking-tight sm:text-[42px]">From scattered rewards to a real purchase.</h2><p className="mx-auto mt-3 max-w-2xl text-[15.5px] text-[var(--color-muted)]">A simple, transparent flow — powered by an AI agent with guardrails.</p></div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[[Ic.wallet, "Connect", "Bring your rewards together in one place."], [Ic.doc, "Read", "The agent reads the fine print and checks eligibility."], [Ic.stack, "Stack", "Finds the best valid combination for the lowest price."], [Ic.bolt, "Pay", "Pays securely with PayPal, within your spending mandate."]].map(([I, t, d], i) => (
            <div key={t as string} className="reveal relative flex flex-col items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-[26px] text-white shadow-[0_18px_40px_-16px_rgba(90,50,230,.6)]" style={{ background: GRAD }}>{(I as (p: IP) => React.ReactNode)({ className: "h-9 w-9" })}</div>
              <div className="mt-4 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#7c3aed] text-[12px] font-bold text-white">{i + 1}</span><span className="text-[17px] font-bold">{t as string}</span></div>
              <p className="mt-2 max-w-[220px] text-[13.5px] text-[var(--color-muted)]">{d as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* REAL EXAMPLE */}
      <section className="mx-auto max-w-5xl px-5 pt-20">
        <div className="reveal grid items-center gap-8 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)]/70 p-7 shadow-sm backdrop-blur lg:grid-cols-[1fr_1.2fr] sm:p-9">
          <div><Pill>Real example</Pill><h3 className="font-display mt-4 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">The “more expensive” store can be cheaper.</h3><p className="mt-3 text-[14.5px] text-[var(--color-muted)]">Same headphones, two stores. RePal checks your rewards and finds the true lowest price.</p></div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5"><span className="flex items-center gap-2.5 text-[14px] font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><Ic.store className="h-4 w-4" /></span>Store B</span><span className="flex items-center gap-3"><b className="text-[16px]">$229</b><span className="rounded-full bg-[var(--color-border)]/40 px-2.5 py-1 text-[11px] text-[var(--color-muted)]">No rewards apply</span></span></div>
            <div className="flex items-center justify-between rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 px-4 py-3.5"><span className="flex items-center gap-2.5 text-[14px] font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c3aed]/12 text-[#7c3aed]"><Ic.store className="h-4 w-4" /></span>Store A</span><span className="flex flex-wrap items-center justify-end gap-2"><b className="text-[16px]">$248</b><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-600">− $30 coupon</span><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-600">− $20 cashback</span></span></div>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-300/50 bg-emerald-50/80 px-4 py-4 dark:bg-emerald-500/10"><div><div className="text-[12px] font-semibold text-slate-600 dark:text-emerald-200">Your Price</div><div className="text-[28px] font-bold text-emerald-600 dark:text-emerald-400">$198</div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300"><Ic.check className="h-4 w-4" />$31 less than Store B</span></div>
          </div>
        </div>
      </section>

      {/* MONEY FLOW */}
      <section id="money" className="mx-auto max-w-5xl px-5 pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="reveal"><Pill>The money flow</Pill><h2 className="font-display mt-4 text-[32px] font-bold leading-tight tracking-tight sm:text-[40px]">Who pays for your rewards?</h2><p className="mt-3 max-w-md text-[15px] text-[var(--color-muted)]">Each reward comes from a different partner, so you can combine them in a single purchase.</p></div>
          <div className="flex flex-col gap-3">
            {[[Ic.gift, "Store Coupons", "Funded by the retailer (from their marketing budget)"], [Ic.tag, "Brand Offers", "Funded by the brand (from promotions)"], [Ic.card, "Card Rewards", "Funded by your card issuer (from interchange)"], [Ic.cashback, "Cashback", "Funded by the store or network (from commissions)"]].map(([I, t, d]) => (
              <div key={t as string} className="reveal flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/70 p-4 shadow-sm backdrop-blur"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD }}>{(I as (p: IP) => React.ReactNode)({ className: "h-5 w-5" })}</span><div><div className="text-[15px] font-bold">{t as string}</div><div className="text-[12.5px] text-[var(--color-muted)]">{d as string}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="mx-auto max-w-6xl px-5 pt-24">
        <div className="reveal rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)]/70 p-8 shadow-sm backdrop-blur">
          <div className="flex flex-col items-start gap-2"><Pill>Built for trust</Pill><h2 className="font-display mt-2 text-[28px] font-bold tracking-tight sm:text-[34px]">You’re always in control.</h2></div>
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[[Ic.bolt, "Powered by PayPal", "Vault, Orders, Payouts"], [Ic.receipt, "Signed Receipts", "Ed25519, publicly verifiable"], [Ic.shield, "Policy Guard", "Allow / Ask / Deny"], [Ic.stack, "Deterministic & Transparent", "Every amount is code-verified"]].map(([I, t, d]) => (
              <div key={t as string} className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/10 text-[#7c3aed]">{(I as (p: IP) => React.ReactNode)({ className: "h-5 w-5" })}</span><div><div className="text-[14.5px] font-bold">{t as string}</div><div className="text-[12.5px] text-[var(--color-muted)]">{d as string}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAS */}
      <section id="personas" className="mx-auto max-w-6xl px-5 pt-24 text-center">
        <h2 className="reveal font-display text-[30px] font-bold tracking-tight sm:text-[38px]">Designed for people who already have rewards.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[[Ic.bag, "Shoppers", "", "Get more value from your existing rewards."], [Ic.bolt, "Smart Spenders", "", "Automatically use the right rewards, no guesswork."], [Ic.stack, "Organization", "Coming Soon", "Manage team spend and reward usage."], [Ic.store, "Businesses", "Coming Soon", "Increase redemptions and drive more sales."]].map(([I, t, tag, d]) => (
            <div key={t as string} className="reveal rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)]/70 p-5 text-left shadow-sm backdrop-blur"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#7c3aed]/10 text-[#7c3aed]">{(I as (p: IP) => React.ReactNode)({ className: "h-5 w-5" })}</span><div className="mt-4 flex items-center gap-2"><span className="text-[16px] font-bold">{t as string}</span>{tag ? <span className="rounded-full bg-[var(--color-border)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">{tag as string}</span> : null}</div><p className="mt-1.5 text-[13px] text-[var(--color-muted)]">{d as string}</p></div>
          ))}
        </div>
      </section>

      {/* FINAL CTA + FOOTER — neon horizon bg */}
      <section className="relative isolate mt-24 overflow-hidden px-5 pb-10 pt-20 text-center text-white">
        <Image src="/bg/neon-horizon.png" alt="" fill priority sizes="100vw" className="pointer-events-none absolute inset-0 object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#140c38]/45" />
        <h2 className="reveal font-display relative text-[34px] font-bold tracking-tight sm:text-[46px]">Try RePal Now</h2>
        <p className="reveal relative mx-auto mt-3 max-w-md text-[15px] text-white/80">Experience the full flow with a live, pre-filled demo.</p>
        <div className="reveal relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DemoCTA dark label="Try Live Demo (No Setup)" />
          <span className="text-[13px] text-white/50">— or —</span>
          <a href="/api/auth/paypal/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-[#2b1065]"><Mark className="h-5 w-5" />Login with PayPal</a>
        </div>
        <p className="reveal relative mt-5 text-[12.5px] text-white/50">ⓘ Uses sample data · No real payment</p>
        <footer className="relative mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/60 sm:flex-row">
          <div className="flex items-center gap-2"><Mark className="h-5 w-5 brightness-0 invert" /><span className="font-semibold text-white">RePal</span> · rewards to real money, on PayPal</div>
          <div className="flex gap-5"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/wallet" className="hover:text-white">Dashboard</Link></div>
        </footer>
      </section>
    </main>
  );
}
