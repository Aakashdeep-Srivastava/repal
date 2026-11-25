"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { judgeLogin, fetchMe } from "@/lib/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/landing/SiteFooter";

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
  search: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  mail: (p: IP) => <svg viewBox="0 0 24 24" fill="none" className={p.className}><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const GRAD = "linear-gradient(100deg,#2563eb 0%,#3b82f6 45%,#2457e6 100%)";
const Mark = ({ className = "" }: { className?: string }) => <Image src="/brand/repal-monogram.png" alt="RePal" width={32} height={32} className={className} />;
const Pill = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/80 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-wide text-[#1d4ed8] shadow-sm backdrop-blur"><Ic.spark className="h-3.5 w-3.5" />{children}</span>;

/* a floating "what the agent does" pill above the orb */
const StepPill = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white/90 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(37,99,235,.5)] backdrop-blur">
    <span className="text-[#2563eb]">{icon}</span>{label}
    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Ic.check className="h-2.5 w-2.5" /></span>
  </span>
);


/** Landing FAQ — real trust/intent questions; also feeds AI-answer citability. */
const FAQS: [string, string][] = [
  ["Is it safe to connect PayPal?", "Yes. RePal never sees your PayPal password or card numbers. You grant a scoped PayPal Vault authority with spending limits you set, and you can revoke it anytime — payments outside your limits are refused before they ever reach PayPal."],
  ["Is RePal free? How do you make money?", "Finding and stacking your rewards is free. RePal earns an agreed commission from merchants and partners when a reward actually drives a purchase — never by marking up your price."],
  ["How do you know my savings are real?", "Every purchase produces an Ed25519-signed receipt you can verify independently. The savings aren't a claim — they're cryptographically provable."],
  ["Does the AI decide how to spend my money?", "No. The AI only reads reward terms and proposes intent. Every amount and payment authority is decided by deterministic, tested code and a policy guard that can allow, ask, or deny."],
  ["Which rewards and stores work?", "Coupons, cashback, gift cards, card points and statement credits. Connect a read-only Gmail scan to find rewards you already have, or claim day-one offers right in your wallet."],
];

export function Landing() {
  const router = useRouter();
  const qc = useQueryClient();
  const root = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Invalidate the cached ["me"] (populated as null while logged out) so the
  // wallet shell shows the signed-in identity instead of stale "Guest"/"there".
  const demo = useMutation({
    mutationFn: judgeLogin,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.push("/wallet");
    },
  });
  // Session awareness — once the visitor has logged in (PayPal or judge demo),
  // the "Login with PayPal" CTAs flip to a "you're in" state so they aren't
  // asked to connect again.
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });
  const loggedIn = Boolean(me);
  const firstName = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0];

  useGSAP(() => {
    // hero intro (on load)
    gsap.from(".hero-in", { opacity: 0, y: 24, duration: 0.8, stagger: 0.12, ease: "power3.out" });

    // section reveals on scroll
    gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
      gsap.from(el, { opacity: 0, y: 48, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });

    // FLOW motion — rewards stream into the agent, a payment pulse travels out,
    // the payment tick keeps a gentle beat.
    gsap.to(".flow-stream", { strokeDashoffset: -36, duration: 1.3, repeat: -1, ease: "none" });
    gsap.timeline({ repeat: -1, repeatDelay: 0.35 })
      .fromTo(".flow-pulse", { left: "0%", opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" })
      .to(".flow-pulse", { left: "100%", duration: 1.3, ease: "none" }, 0)
      .to(".flow-pulse", { opacity: 0, duration: 0.25, ease: "none" }, 1.1);

    // Demo video — a premium entrance: rises and scales up as it enters view.
    gsap.from(".demo-frame", {
      opacity: 0, y: 64, scale: 0.95, duration: 1.05, ease: "power3.out",
      scrollTrigger: { trigger: ".demo-frame", start: "top 82%" },
    });

    // Play the demo only while it is on screen; pause when it scrolls away.
    // (Muted, so programmatic play() is permitted; users can unmute via controls.)
    ScrollTrigger.create({
      trigger: ".demo-frame",
      start: "top 75%",
      end: "bottom 25%",
      onToggle: (self) => {
        const v = videoRef.current;
        if (!v) return;
        if (self.isActive) void v.play().catch(() => {});
        else v.pause();
      },
    });

    // Ambient life — gated behind prefers-reduced-motion so it never nags users
    // who opt out. gsap.matchMedia() is tracked by this context and auto-reverts.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(".hero-blob", {
        y: 26, duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true,
        stagger: { each: 1.6, from: "edges" },
      });
      gsap.to(".agent-orb", { scale: 1.04, duration: 2.4, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
  }, { scope: root });

  const NAV = [["How it Works", "#how"], ["Rewards", "#money"], ["Security", "#trust"], ["For Merchants", "#personas"], ["Resources", "#how"]];
  const trust = [["You stay in control", Ic.shield], ["Pays with PayPal", Ic.bolt], ["Stacks only valid rewards", Ic.stack], ["Verifiable receipts", Ic.check]] as const;

  const PrimaryCTA = ({ cls = "" }: { cls?: string }) =>
    loggedIn ? (
      <Link href="/wallet" className={`inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-[15px] font-semibold text-white shadow-[0_14px_34px_-12px_rgba(37,99,235,.7)] transition-transform hover:-translate-y-0.5 ${cls}`} style={{ background: GRAD }}><Ic.check className="h-5 w-5" />{firstName ? `Continue as ${firstName}` : "Go to your wallet"} →</Link>
    ) : (
      <a href="/api/auth/paypal/login" className={`inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-[15px] font-semibold text-white shadow-[0_14px_34px_-12px_rgba(37,99,235,.7)] transition-transform hover:-translate-y-0.5 ${cls}`} style={{ background: GRAD }}><Mark className="h-5 w-5 brightness-0 invert" />Login with PayPal</a>
    );
  const DemoCTA = ({ dark = false, label = "Try Live Demo", cls = "" }: { dark?: boolean; label?: string; cls?: string }) => (
    <button onClick={() => demo.mutate()} disabled={demo.isPending} className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-[15px] font-semibold transition-colors disabled:opacity-60 ${dark ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-[#2563eb]/40"} ${cls}`}><Ic.play className="h-5 w-5 text-[#2563eb]" />{demo.isPending ? "Starting…" : label}</button>
  );

  return (
    <main ref={root} className="relative min-h-dvh overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="hero-blob absolute -left-40 top-0 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#93c5fd,transparent 60%)" }} />
        <div className="hero-blob absolute -right-40 top-40 h-[560px] w-[560px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#8fd0ff,transparent 60%)" }} />
      </div>

      {/* NAV */}
      <header className="sticky top-4 z-50 mx-auto mt-4 flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/60 bg-[var(--color-card)]/75 px-4 py-2.5 shadow-[0_10px_30px_-18px_rgba(37,99,235,.5)] backdrop-blur-xl sm:px-5">
        <Link href="/" className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="text-lg font-bold tracking-tight">Re<span className="text-[#2563eb]">Pal</span></span></Link>
        <nav className="hidden items-center gap-6 text-[14px] font-medium text-[var(--color-muted)] lg:flex">{NAV.map(([l, h]) => <a key={l} href={h} className="hover:text-[var(--color-fg)]">{l}</a>)}</nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => demo.mutate()} className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-[13.5px] font-semibold text-[var(--color-fg)] hover:border-[#2563eb]/40 sm:inline-flex"><Ic.play className="h-4 w-4 text-[#2563eb]" />Live Demo</button>
          {loggedIn ? (
            <Link href="/wallet" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white" style={{ background: GRAD }}><Ic.check className="h-4 w-4" /><span className="hidden sm:inline">My wallet</span><span className="sm:hidden">Wallet</span></Link>
          ) : (
            <a href="/api/auth/paypal/login" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white" style={{ background: GRAD }}><span className="hidden sm:inline">Login with PayPal</span><span className="sm:hidden">Login</span></a>
          )}
        </div>
      </header>

      {/* HERO (text) */}
      <section className="mx-auto max-w-5xl px-5 pt-14 text-center sm:pt-20">
        <div className="hero-in flex justify-center"><Pill>Your AI Rewards Agent</Pill></div>
        <h1 className="hero-in font-display mx-auto mt-6 max-w-3xl text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[64px]">The cheapest price <em className="not-italic" style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontStyle: "italic" }}>after</em> your rewards.</h1>
        <p className="hero-in mx-auto mt-5 max-w-xl text-[16px] text-[var(--color-muted)] sm:text-[18px]">RePal reads your rewards&apos; fine print, stacks every valid offer, and pays with PayPal — then hands you a signed receipt proving what you saved. All within the limits you set.</p>
        <div className="hero-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><PrimaryCTA /><DemoCTA /></div>
        <div className="hero-in mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-medium text-[var(--color-muted)]">{trust.map(([l, I]) => <span key={l} className="inline-flex items-center gap-1.5"><I className="h-4 w-4 text-[#2563eb]" />{l}</span>)}</div>
        <a href="#demo" className="hero-in mx-auto mt-10 grid h-9 w-9 animate-bounce place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-sm"><Ic.arrowD className="h-4 w-4" /></a>
      </section>

      {/* DEMO VIDEO — the fastest way to "get it": watch the real /stack flow */}
      <section id="demo" className="mx-auto max-w-5xl px-5 pt-24 text-center">
        <div className="reveal flex flex-col items-center">
          <Pill>See it in action</Pill>
          <h2 className="font-display mt-5 text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[46px]">Watch rewards become{" "}
            <em className="italic" style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>one payment.</em>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--color-muted)] sm:text-[16px]">A 40-second walkthrough: RePal reads the fine print on 9 rewards, voids what can&apos;t stack, and combines the 4 that fit — <strong className="text-[var(--color-fg)]">$249.99 → $157.59</strong>, saving $92.40 in one PayPal payment.</p>
        </div>
        <div className="demo-frame mx-auto mt-9 max-w-4xl overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_30px_80px_-30px_rgba(37,99,235,.5)]">
          <video
            ref={videoRef}
            className="block w-full"
            src="/media/repal-demo-desktop.mp4"
            poster="/media/repal-demo-poster.jpg"
            controls
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="RePal product demo — stacking rewards into one PayPal payment"
          />
        </div>
        <div className="reveal mt-4 text-[13px] text-[var(--color-muted)]">🔊 Unmute for the narrated version &nbsp;·&nbsp; <a href="/media/repal-demo-vertical.mp4" className="font-semibold text-[#2563eb] hover:underline">vertical cut</a> &nbsp;·&nbsp; <a href="/stack" className="font-semibold text-[#2563eb] hover:underline">try it live →</a></div>
      </section>

      {/* FLOW — rewards in one place → agent → best price, then the 4 steps */}
      <section id="how" className="relative mx-auto max-w-6xl px-5 pt-24 text-center">
        <div className="reveal flex flex-col items-center">
          <Pill>How it flows</Pill>
          <h2 className="font-display mt-5 text-[32px] font-bold leading-[1.08] tracking-tight text-[#141033] sm:text-[48px]">Rewards flow in. One payment{" "}
            <em className="italic" style={{ background: "linear-gradient(100deg,#1d4ed8 0%,#3b82f6 55%,#2563eb 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>flows out.</em>
          </h2>
        </div>

        {/* infographic: panel → agent → best price (connectors anchored to the orb) */}
        <div className="reveal mt-14 grid items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_auto_minmax(0,1fr)]">
          {/* LEFT — Your Rewards in One Place (supplied card image, cropped to the card) */}
          <div className="overflow-hidden rounded-[22px] shadow-[0_24px_60px_-30px_rgba(37,99,235,.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rewards-panel.png" alt="Your rewards in one place: payment cards, email rewards, gift cards, and reward points brought together" className="block w-full" />
          </div>

          {/* CENTER — the agent, with floating "what it does" pills + connectors on the orb */}
          <div className="flex flex-col items-center">
            <div className="mb-5 flex flex-wrap justify-center gap-2 lg:mb-6">
              <StepPill icon={<Ic.search className="h-3.5 w-3.5" />} label="Reads terms" />
              <StepPill icon={<Ic.stack className="h-3.5 w-3.5" />} label="Checks eligibility" />
              <StepPill icon={<Ic.shield className="h-3.5 w-3.5" />} label="Applies rules" />
            </div>
            <div className="relative">
              {/* input streams — touch the orb's left edge; dashes flow toward the agent */}
              <svg aria-hidden viewBox="0 0 150 112" preserveAspectRatio="none" className="absolute right-full top-1/2 hidden h-28 w-[150px] -translate-y-1/2 lg:block">
                {[12, 44, 70, 100].map((y, i) => <path key={i} className="flow-stream" d={`M0 ${y} C 78 ${y}, 94 56, 150 56`} fill="none" stroke="#93b4fb" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="7 11" opacity={0.65} />)}
              </svg>
              {/* output payment arrow — touches the orb's right edge; a pulse travels to best price */}
              <div aria-hidden className="absolute left-full top-1/2 hidden w-[150px] -translate-y-1/2 items-center lg:flex">
                <div className="relative flex-1">
                  <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-[#047857] to-[#065f46] shadow-[0_0_8px_1px_rgba(5,95,70,.45)]" />
                  <span className="flow-pulse absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#065f46] shadow-[0_0_8px_2px_rgba(5,95,70,.6)]" style={{ left: "0%" }} />
                </div>
                <div className="h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[#065f46]" />
              </div>
              {/* the orb (compact) */}
              <div className="agent-orb relative grid h-24 w-24 place-items-center overflow-hidden rounded-[26px] shadow-[0_28px_60px_-22px_rgba(37,99,235,.75)]" style={{ background: GRAD }}>
                <span aria-hidden className="absolute -inset-5 -z-10 rounded-full opacity-45 blur-2xl" style={{ background: GRAD }} />
                <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_25%_15%,rgba(255,255,255,.55),transparent_55%)]" />
                <Mark className="relative h-12 w-12 brightness-0 invert" />
              </div>
            </div>
            <span className="mt-4 inline-block rounded-full bg-white/90 px-4 py-1.5 text-[13.5px] font-bold text-[#141033] shadow-sm backdrop-blur">RePal Agent</span>
          </div>

          {/* RIGHT — stacked rewards transaction summary (supplied card image) */}
          <div className="overflow-hidden rounded-[22px] shadow-[0_26px_55px_-24px_rgba(5,95,70,.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/transaction-summary.png" alt="Rewards applied in this transaction: Amazon coupon minus $30, Visa card offer minus 10%, Gmail offer minus $15, Starbucks cashback minus $20 — total minus $65, you save 26%" className="block w-full" />
          </div>
        </div>
      </section>

      {/* REAL EXAMPLE */}
      <section className="mx-auto max-w-5xl px-5 pt-20">
        <div className="reveal grid items-center gap-8 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)]/70 p-7 shadow-sm backdrop-blur lg:grid-cols-[1fr_1.2fr] sm:p-9">
          <div><Pill>Real example</Pill><h3 className="font-display mt-4 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">The “more expensive” store can be cheaper.</h3><p className="mt-3 text-[14.5px] text-[var(--color-muted)]">Same headphones, two stores. RePal checks your rewards and finds the true lowest price.</p></div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5"><span className="flex items-center gap-2.5 text-[14px] font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><Ic.store className="h-4 w-4" /></span>Store B</span><span className="flex items-center gap-3"><b className="text-[16px]">$229</b><span className="rounded-full bg-[var(--color-border)]/40 px-2.5 py-1 text-[11px] text-[var(--color-muted)]">No rewards apply</span></span></div>
            <div className="flex items-center justify-between rounded-2xl border border-[#2563eb]/30 bg-[#2563eb]/5 px-4 py-3.5"><span className="flex items-center gap-2.5 text-[14px] font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563eb]/12 text-[#2563eb]"><Ic.store className="h-4 w-4" /></span>Store A</span><span className="flex flex-wrap items-center justify-end gap-2"><b className="text-[16px]">$248</b><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-600">− $30 coupon</span><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-600">− $20 cashback</span></span></div>
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
              <div key={t as string} className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">{(I as (p: IP) => React.ReactNode)({ className: "h-5 w-5" })}</span><div><div className="text-[14.5px] font-bold">{t as string}</div><div className="text-[12.5px] text-[var(--color-muted)]">{d as string}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAS */}
      <section id="personas" className="mx-auto max-w-6xl px-5 pt-24 text-center">
        <h2 className="reveal font-display text-[30px] font-bold tracking-tight sm:text-[38px]">Designed for people who already have rewards.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[[Ic.bag, "Shoppers", "", "Get more value from your existing rewards."], [Ic.bolt, "Smart Spenders", "", "Automatically use the right rewards, no guesswork."], [Ic.stack, "Organization", "Coming Soon", "Manage team spend and reward usage."], [Ic.store, "Businesses", "Coming Soon", "Increase redemptions and drive more sales."]].map(([I, t, tag, d]) => (
            <div key={t as string} className="reveal rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)]/70 p-5 text-left shadow-sm backdrop-blur"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">{(I as (p: IP) => React.ReactNode)({ className: "h-5 w-5" })}</span><div className="mt-4 flex items-center gap-2"><span className="text-[16px] font-bold">{t as string}</span>{tag ? <span className="rounded-full bg-[var(--color-border)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">{tag as string}</span> : null}</div><p className="mt-1.5 text-[13px] text-[var(--color-muted)]">{d as string}</p></div>
          ))}
        </div>
      </section>

      {/* WHY NOT AN ADVISOR — the differentiator vs rewards-advisor apps */}
      <section className="mx-auto max-w-5xl px-5 pt-24">
        <div className="flex flex-col items-start gap-2"><Pill>Why RePal</Pill>
          <h2 className="font-display mt-2 text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">Rewards advisors tell you what to do. RePal does it — and proves it.</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">A typical rewards app</div>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-fg)]">&ldquo;Use this card for 5% back.&rdquo; Then you have to remember it, apply it at checkout, and hope it actually worked.</p>
          </div>
          <div className="rounded-[22px] border border-[#2563eb]/30 bg-[#2563eb]/5 p-6 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#2563eb]">RePal</div>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-fg)]">The agent reads the fine print, stacks every valid reward, pays with PayPal within your limits, and gives you a <strong>signed, verifiable receipt</strong> of exactly what you saved. Nothing to remember, nothing to trust on faith.</p>
          </div>
        </div>
      </section>

      {/* FAQ — content depth, trust answers, and AI-answer citability */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pt-24">
        <div className="flex flex-col items-start gap-2"><Pill>FAQ</Pill>
          <h2 className="font-display mt-2 text-[28px] font-bold tracking-tight sm:text-[36px]">Questions people ask first.</h2>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group rounded-[18px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15.5px] font-semibold text-[var(--color-fg)]">{q}<span aria-hidden className="shrink-0 text-xl text-[var(--color-muted)] transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* premium closing — CTA + multi-column footer */}
      <SiteFooter />
    </main>
  );
}
