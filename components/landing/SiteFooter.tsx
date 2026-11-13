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
const GRAD = "linear-gradient(100deg,#7c3aed 0%,#5b4be6 45%,#2457e6 100%)";

/* one node in the reward-flow diagram */
function Node({ icon, label, tone = "purple", orb = false }: { icon: React.ReactNode; label: string; tone?: "purple" | "green"; orb?: boolean }) {
  return (
    <div className="f-node flex shrink-0 flex-col items-center gap-2 text-center">
      <div className={`${orb ? "f-orb h-14 w-14 sm:h-16 sm:w-16" : "h-12 w-12 sm:h-14 sm:w-14"} relative grid place-items-center rounded-2xl ring-1 ring-white/20`} style={orb ? { background: GRAD } : { background: "rgba(255,255,255,.08)" }}>
        {orb && <span aria-hidden className="absolute -inset-3 -z-10 rounded-full opacity-50 blur-xl" style={{ background: GRAD }} />}
        <span className={orb ? "text-white" : tone === "green" ? "text-emerald-300" : "text-violet-200"}>{icon}</span>
      </div>
      <span className="text-[11px] font-medium text-white/70 sm:text-[12px]">{label}</span>
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
      gsap.set(".f-path", { strokeDashoffset: 1 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 78%" } });
      tl.from(".f-node", { opacity: 0, scale: 0.8, stagger: 0.12, duration: 0.5, ease: "back.out(1.6)" })
        .to(".f-path-in", { strokeDashoffset: 0, opacity: 1, stagger: 0.18, duration: 0.5, ease: "none" }, 0.2)
        .to(".f-path-out", { strokeDashoffset: 0, opacity: 1, duration: 0.5, ease: "none" }, ">-0.1")
        .from(".f-head", { opacity: 0, y: 24, duration: 0.6, ease: "power3.out" }, "<0.1")
        .from(".f-desc", { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, "<0.15")
        .from(".f-btn", { opacity: 0, y: 16, stagger: 0.1, duration: 0.5 }, "<0.1")
        .from(".f-note", { opacity: 0, duration: 0.5 }, "<0.1")
        .from(".f-trust", { opacity: 0, y: 14, stagger: 0.1, duration: 0.5 }, "<0.05")
        .from(".f-nav", { opacity: 0, y: 18, stagger: 0.06, duration: 0.5 }, "<0.1");
      // continuous, gentle ambient + orb float
      gsap.to(".f-orb", { y: -8, duration: 2.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".f-amb", { xPercent: 10, yPercent: -8, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" });
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
    <footer ref={root} className="relative isolate -mt-6 overflow-hidden rounded-t-[32px] text-white sm:rounded-t-[48px]">
      <Image src="/bg/neon-horizon.png" alt="" fill priority sizes="100vw" className="pointer-events-none absolute inset-0 object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120a34]/80 via-[#140c38]/55 to-[#140c38]/75" />
      {/* haze: blend the rounded top into the light section above */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-32 bg-gradient-to-b from-[var(--color-bg)] via-[var(--color-bg)]/45 to-transparent" />
      <div aria-hidden className="f-amb pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle,#8b5cf6,transparent 62%)" }} />

      <div className="relative z-[3] mx-auto max-w-6xl px-5 pb-10 pt-28 sm:pt-32">
        {/* reward-flow diagram */}
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            <svg aria-hidden viewBox="0 0 800 70" className="absolute inset-x-0 top-1/2 -z-0 h-16 w-full -translate-y-[60%]" preserveAspectRatio="none">
              <defs><filter id="fglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              <path className="f-path f-path-in" d="M135 35 L265 35" pathLength={1} strokeDasharray={1} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" filter="url(#fglow)" opacity={0.3} />
              <path className="f-path f-path-in" d="M335 35 L465 35" pathLength={1} strokeDasharray={1} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" filter="url(#fglow)" opacity={0.3} />
              <path className="f-path f-path-out" d="M535 35 L665 35" pathLength={1} strokeDasharray={1} fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" filter="url(#fglow)" opacity={0.3} />
            </svg>
            <div className="relative flex items-start justify-between gap-2">
              <Node icon={<Ic.wallet className="h-5 w-5 sm:h-6 sm:w-6" />} label="Wallet" />
              <Node icon={<Mark className="h-7 w-7 brightness-0 invert sm:h-8 sm:w-8" />} label="Agent" orb />
              <Node icon={<Ic.check className="h-5 w-5 sm:h-6 sm:w-6" />} label="Valid Rewards" />
              <Node icon={<Mark className="h-5 w-5 brightness-0 invert sm:h-6 sm:w-6" />} label="PayPal" tone="green" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <h2 className="f-head font-display text-[32px] font-bold leading-tight tracking-tight sm:text-[46px]">Your next purchase could cost less.</h2>
          <p className="f-desc mx-auto mt-4 max-w-xl text-[15px] text-white/75 sm:text-[16px]">RePal reads the fine print on every reward you hold, stacks only the ones that are eligible, and settles the single lowest price with PayPal — all within the spending limits you set.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => demo.mutate()} disabled={demo.isPending} className="f-btn inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_-14px_rgba(130,90,250,.8)] transition-transform hover:-translate-y-0.5 disabled:opacity-60" style={{ background: GRAD }}><Ic.play className="h-5 w-5" />{demo.isPending ? "Starting…" : "Try Live Demo"}</button>
            <a href="/api/auth/paypal/login" className="f-btn inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"><Mark className="h-5 w-5 brightness-0 invert" />Login with PayPal</a>
          </div>
          <p className="f-note mt-5 text-[12.5px] text-white/50">No setup · Sample data · No real payment</p>
          <ul className="f-trust-wrap mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] font-medium text-white/80">
            {trust.map(([l, I]) => <li key={l} className="f-trust inline-flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-violet-200 ring-1 ring-white/15"><I className="h-4 w-4" /></span>{l}</li>)}
          </ul>
        </div>

        {/* nav — mobile: 2-col groups; tablet: balanced; desktop: multi-col */}
        <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 md:grid-cols-[1.2fr_2.6fr]">
          <div className="f-nav max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2"><Mark className="h-7 w-7 brightness-0 invert" /><span className="text-lg font-bold tracking-tight">RePal</span></Link>
            <p className="mt-3 text-[13px] leading-relaxed text-white/60">The rewards you already have, turned into real money — read, stacked, and paid with PayPal. You stay in control; every move is a signed, verifiable receipt.</p>
            <div className="mt-4 flex gap-2">
              <a href="https://github.com/Aakashdeep-Srivastava/repal" target="_blank" rel="noopener noreferrer" aria-label="RePal on GitHub" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/15"><Ic.github className="h-5 w-5" /></a>
              <button onClick={() => demo.mutate()} aria-label="Try live demo" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/15"><Ic.play className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4">
            {NAV.map((col) => (
              <nav key={col.title} className="f-nav" aria-label={col.title}>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/50">{col.title}</h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-[13.5px]">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.demo ? (
                        <button onClick={() => demo.mutate()} className="text-left text-white/70 transition-colors hover:text-white">{l.label}</button>
                      ) : (
                        <Link href={l.href!} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[12.5px] text-white/50 sm:flex-row">
          <span>© {2026} RePal · rewards to real money, on PayPal</span>
          <div className="flex gap-5"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/wallet" className="hover:text-white">Dashboard</Link></div>
        </div>
      </div>
    </footer>
  );
}
