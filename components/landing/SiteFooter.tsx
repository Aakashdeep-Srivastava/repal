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

gsap.registerPlugin(ScrollTrigger, useGSAP);

type IP = { className?: string };
const Ic = {
  wallet: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M16 12h3M3 9.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  stack: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  check: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M8.5 12l2.5 2.5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  shield: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  receipt: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  play: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" /></svg>,
  github: (p: IP) => <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.26-.45-1.28.1-2.65 0 0 .84-.27 2.75 1.03a9.6 9.6 0 0 1 5 0c1.9-1.3 2.74-1.03 2.74-1.03.55 1.37.2 2.39.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" /></svg>,
};
const Mark = ({ className = "" }: { className?: string }) => <Image src="/brand/repal-monogram.png" alt="RePal" width={32} height={32} className={className} />;
const GRAD = "linear-gradient(100deg,#2563eb 0%,#3b82f6 45%,#2457e6 100%)";
/* Two-tone PayPal "PP" monogram (brand navy + cyan). */
const PayPalMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path fill="#27346A" d="M8.2 4h5.2c2.7 0 4.6 1.5 4.1 4.4-.5 3-2.8 4.6-5.8 4.6H9.4c-.5 0-.9.4-1 .9l-.82 5.4c-.05.4-.3.6-.68.6H4.5c-.42 0-.64-.3-.58-.72L6 5c.2-.63.78-1 2.2-1z" />
    <path fill="#2790C3" d="M11.5 7h5.2c2.7 0 4.6 1.5 4.1 4.4-.5 3-2.8 4.6-5.8 4.6h-2.3c-.5 0-.9.4-1 .9l-.82 5.4c-.05.4-.3.6-.68.6H7.8c-.42 0-.64-.3-.58-.72L9.3 8c.2-.63.78-1 2.2-1z" />
  </svg>
);

/* reward-flow node — all nodes share one size + baseline (aligned on one line) */
function Node({ label, orb = false, children }: { label: string; orb?: boolean; children: React.ReactNode }) {
  return (
    <div className="f-node relative z-10 flex flex-col items-center gap-2.5 text-center">
      <div className={`relative grid h-16 w-16 place-items-center rounded-2xl ${orb ? "ring-1 ring-white/30 shadow-[0_16px_36px_-12px_rgba(37,99,235,.7)]" : "border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm"}`} style={orb ? { background: GRAD } : undefined}>
        {orb && <span aria-hidden className="absolute -inset-2.5 -z-10 rounded-full opacity-45 blur-xl" style={{ background: GRAD }} />}
        {children}
      </div>
      <span className="text-[11.5px] font-medium text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

export function SiteFooter() {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const demo = useMutation({ mutationFn: judgeLogin, onSuccess: () => router.push("/wallet") });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 80%" } });
      tl.from(".f-node", { opacity: 0, y: 14, scale: 0.9, stagger: 0.1, duration: 0.5, ease: "back.out(1.5)" })
        .from(".f-head", { opacity: 0, y: 24, duration: 0.6, ease: "power3.out" }, "<0.15")
        .from(".f-desc", { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, "<0.15")
        .from(".f-btn", { opacity: 0, y: 16, stagger: 0.1, duration: 0.5 }, "<0.1")
        .from(".f-note", { opacity: 0, duration: 0.5 }, "<0.1")
        .from(".f-trust", { opacity: 0, y: 14, stagger: 0.1, duration: 0.5 }, "<0.05")
        .from(".f-box", { opacity: 0, y: 28, duration: 0.7, ease: "power3.out" }, "<0.1");
    });
  }, { scope: root });

  const NAV: { title: string; links: { label: string; href?: string; demo?: boolean }[] }[] = [
    { title: "Product", links: [{ label: "Reward Wallet", href: "/wallet" }, { label: "Mandate Studio", href: "/mandate" }, { label: "Shop", href: "/shop" }, { label: "Insights", href: "/insights" }] },
    { title: "Explore", links: [{ label: "Coupon Stacking", href: "/stack" }, { label: "Reward Rescue", href: "/rescue" }, { label: "How it works", href: "/#how" }, { label: "Live Demo", demo: true }] },
    { title: "Trust", links: [{ label: "Security", href: "/#trust" }, { label: "Signed receipts", href: "/#trust" }, { label: "The money flow", href: "/#money" }, { label: "Login with PayPal", href: "/api/auth/paypal/login" }] },
    { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
  ];
  const trust = [["User-controlled limits", Ic.shield], ["Eligible rewards only", Ic.stack], ["Verifiable receipts", Ic.receipt]] as const;

  return (
    <footer ref={root} className="relative mx-auto max-w-6xl px-5 pb-12 pt-20 sm:pt-24">
      {/* reward-flow diagram — all nodes uniform + aligned on one line */}
      <div className="relative mx-auto max-w-xl">
        <div aria-hidden className="pointer-events-none absolute left-[14%] right-[14%] top-8 z-0 h-px bg-[var(--color-border)]" />
        <div className="relative flex items-start justify-between">
          <Node label="Wallet"><span className="text-[#2563eb]"><Ic.wallet className="h-6 w-6" /></span></Node>
          <Node label="Agent" orb><Mark className="h-8 w-8 brightness-0 invert" /></Node>
          <Node label="Valid Rewards"><span className="text-[#2563eb]"><Ic.check className="h-6 w-6" /></span></Node>
          <Node label="PayPal"><PayPalMark className="h-8 w-8" /></Node>
        </div>
      </div>

      {/* CTA — light */}
      <div className="mx-auto mt-12 max-w-2xl text-center">
        <h2 className="f-head font-display text-[32px] font-bold leading-tight tracking-tight text-[var(--color-fg)] sm:text-[46px]">Your next purchase could cost less.</h2>
        <p className="f-desc mx-auto mt-4 max-w-xl text-[15px] text-[var(--color-muted)] sm:text-[16px]">RePal reads the fine print on every reward you hold, stacks only the ones that are eligible, and settles the single lowest price with PayPal — all within the spending limits you set.</p>
        <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
          <button onClick={() => demo.mutate()} disabled={demo.isPending} className="f-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_-14px_rgba(37,99,235,.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60 sm:px-7" style={{ background: GRAD }}><Ic.play className="h-5 w-5" />{demo.isPending ? "Starting…" : "Try Live Demo"}</button>
          <a href="/api/auth/paypal/login" className="f-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-3.5 text-[15px] font-semibold text-[var(--color-fg)] transition-colors hover:border-[#2563eb]/40 sm:px-7"><Mark className="h-5 w-5" />Login with PayPal</a>
        </div>
        <p className="f-note mt-5 text-[12.5px] text-[var(--color-muted)]">No setup · Sample data · No real payment</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] font-medium text-[var(--color-fg)]">
          {trust.map(([l, I]) => <li key={l} className="f-trust inline-flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#2563eb]/10 text-[#2563eb] ring-1 ring-[var(--color-border)]"><I className="h-4 w-4" /></span>{l}</li>)}
        </ul>
      </div>

      {/* FOOTER BOX — the neon background lives ONLY inside this contained box */}
      <div className="f-box relative isolate mt-16 overflow-hidden rounded-[28px] text-white shadow-[0_30px_80px_-34px_rgba(23,47,120,.55)]">
        <Image src="/bg/neon-horizon.png" alt="" width={2172} height={724} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#140c38]/75 via-[#140c38]/55 to-[#140c38]/80" />
        <div className="relative p-7 sm:p-10">
          <div className="grid gap-10 md:grid-cols-[1.2fr_2.6fr]">
            <div className="max-w-sm">
              <Link href="/" className="inline-flex items-center gap-2"><Mark className="h-7 w-7 brightness-0 invert" /><span className="text-lg font-bold tracking-tight">RePal</span></Link>
              <p className="mt-3 text-[13px] leading-relaxed text-white/60">The rewards you already have, turned into real money — read, stacked, and paid with PayPal. You stay in control; every move is a signed, verifiable receipt.</p>
              <div className="mt-4 flex gap-2">
                <a href="https://github.com/Aakashdeep-Srivastava/repal" target="_blank" rel="noopener noreferrer" aria-label="RePal on GitHub" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/15"><Ic.github className="h-5 w-5" /></a>
                <button onClick={() => demo.mutate()} aria-label="Try live demo" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/15"><Ic.play className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4">
              {NAV.map((col) => (
                <nav key={col.title} aria-label={col.title}>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/50">{col.title}</h3>
                  <ul className="mt-4 flex flex-col gap-2.5 text-[13.5px]">
                    {col.links.map((l) => (
                      <li key={l.label}>{l.demo ? <button onClick={() => demo.mutate()} className="text-left text-white/70 transition-colors hover:text-white">{l.label}</button> : <Link href={l.href!} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>}</li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[12.5px] text-white/50 sm:flex-row">
            <span>© {2026} RePal · rewards to real money, on PayPal</span>
            <div className="flex gap-5"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/wallet" className="hover:text-white">Dashboard</Link></div>
          </div>
        </div>
      </div>
    </footer>
  );
}
