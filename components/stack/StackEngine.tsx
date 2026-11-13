"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { MerchantLogo } from "@/components/rewards/MerchantLogo";
import { computeStack, fmt, type Stackable, type StackResult, type StackStep } from "@/lib/stack/compute";
import { DEMO_CONTEXT, DEMO_PRICE, DEMO_PRODUCT, DEMO_WALLET } from "@/lib/stack/demo";

/* ─────────── scan-beat engine (deterministic order from computeStack) ─────────── */
type Beat = { kind: "apply"; step: StackStep } | { kind: "skip"; item: Stackable; reason: string };
function buildBeats(r: StackResult): Beat[] {
  const applies: Beat[] = r.steps.map((step) => ({ kind: "apply", step }));
  const skips: Beat[] = r.rejected.map((x) => ({ kind: "skip", item: x.item, reason: x.reason }));
  const out: Beat[] = [];
  while (applies.length || skips.length) { if (applies.length) out.push(applies.shift()!); if (skips.length) out.push(skips.shift()!); }
  return out;
}
const beatId = (b: Beat) => (b.kind === "apply" ? b.step.item.id : b.item.id);
const short = (s: Stackable) => (s.type === "pct_off" || s.type === "cashback_pct" ? `${s.value}%` : `$${Number.isInteger(s.value) ? s.value : s.value.toFixed(2)}`);
const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

export function StackEngine() {
  const result = useMemo(() => computeStack(DEMO_PRICE, DEMO_WALLET, DEMO_CONTEXT), []);
  const beats = useMemo(() => buildBeats(result), [result]);
  const [n, setN] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [run, setRun] = useState(0);
  const [paid, setPaid] = useState<number | null>(null);
  const done = n >= beats.length;
  const beatMs = 1050;

  useEffect(() => {
    if (done) return;
    const t = scanning
      ? setTimeout(() => { setScanning(false); setN((x) => x + 1); }, beatMs * 0.42)
      : setTimeout(() => setScanning(true), n === 0 ? 650 : beatMs * 0.58);
    return () => clearTimeout(t);
  }, [n, scanning, done, run]);

  const finished = beats.slice(0, n);
  const applied = finished.filter((b): b is Extract<Beat, { kind: "apply" }> => b.kind === "apply").map((b) => b.step);
  const skipped = new Map(finished.filter((b) => b.kind === "skip").map((b) => [beatId(b), (b as Extract<Beat, { kind: "skip" }>).reason]));
  const usedIds = new Set(applied.map((s) => s.item.id));
  const checking = scanning && !done ? beats[n] : null;
  const due = applied.length ? applied[applied.length - 1].runningCents : result.priceCents;

  const status = done
    ? `${applied.length} of ${DEMO_WALLET.length} rewards fit · ${fmt(result.savedCents)} saved`
    : checking
      ? `Checking ${checking.kind === "apply" ? checking.step.item.label : checking.item.label} …`
      : `Reading the fine print on ${DEMO_WALLET.length} rewards`;

  const replay = () => { setN(0); setScanning(false); setPaid(null); setRun((r) => r + 1); };

  return (
    <LayoutGroup id={"engine" + run}>
      <main className="stack-engine relative min-h-dvh overflow-hidden bg-[#09090c] text-[#ece6da]">
        {/* atmosphere: grain + vignette + a single green bloom */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% -10%, transparent 40%, rgba(0,0,0,.55) 100%)" }} />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full opacity-25 blur-[120px]" style={{ background: "radial-gradient(circle,#15e08a,transparent 60%)" }} />

        {/* header */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5"><Image src="/brand/repal-monogram.png" alt="RePal" width={26} height={26} className="h-6 w-6" /><span className="font-mono-stack text-[13px] uppercase tracking-[0.3em] text-[#8f897d]">RePal · The Stack</span></Link>
          <Link href="/wallet" className="font-mono-stack text-[12px] uppercase tracking-[0.2em] text-[#8f897d] transition-colors hover:text-[#ece6da]">Wallet →</Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-4 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-16 lg:pt-10">
          {/* ── LEFT: editorial + kinetic numbers + ledger ── */}
          <section>
            <span className="font-mono-stack inline-flex items-center gap-2 rounded-full border border-[#2a2a30] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[#15e08a]"><span className="h-1.5 w-1.5 rounded-full bg-[#15e08a] shadow-[0_0_10px_#15e08a]" />Sandbox · sample rewards</span>

            <h1 className="font-display-stack mt-7 text-[clamp(2.6rem,6vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.02em]">
              One tap.<br />Every eligible reward,<br /><em className="italic text-[#15e08a]">stacked into one payment.</em>
            </h1>

            <div className="mt-8 flex items-center gap-3 text-[14px] text-[#b7b1a4]">
              <MerchantLogo domain={DEMO_PRODUCT.domain} name={DEMO_PRODUCT.merchant} size={32} />
              <span className="font-semibold text-[#ece6da]">{DEMO_PRODUCT.name}</span><span className="text-[#6c675d]">·</span><span>{DEMO_PRODUCT.merchant}</span>
              <span className="ml-auto font-mono-stack text-[13px] text-[#6c675d] line-through">{fmt(result.priceCents)}</span>
            </div>

            {/* the kinetic pay figure */}
            <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className="font-mono-stack text-[11px] uppercase tracking-[0.28em] text-[#8f897d]">{done ? "One PayPal payment" : "Running total"}</div>
                <NumberFlow value={due / 100} format={{ style: "currency", currency: "USD" }} className="font-display-stack mt-1 text-[clamp(3rem,9vw,5.5rem)] font-semibold leading-none tracking-[-0.03em] text-[#f3eee3]" style={{ textShadow: "0 0 50px rgba(21,224,138,.18)" }} transformTiming={{ duration: 720, easing: "cubic-bezier(.22,1,.36,1)" }} />
              </div>
              <AnimatePresence>
                {applied.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                    <div className="font-mono-stack text-[11px] uppercase tracking-[0.28em] text-[#8f897d]">You save</div>
                    <NumberFlow value={(result.priceCents - due) / 100} format={{ style: "currency", currency: "USD" }} className="font-display-stack mt-1 text-[clamp(1.6rem,4vw,2.4rem)] font-medium leading-none text-[#15e08a]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* the ledger — receipt press */}
            <div className="mt-9 max-w-md border-t border-dashed border-[#2a2a30] pt-5">
              <Row label="List price" value={fmt(result.priceCents)} dim />
              <AnimatePresence initial={false}>
                {applied.map((s) => (
                  <motion.div key={"l" + s.item.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
                    <Row label={s.item.label} hint={s.item.kind} value={"− " + fmt(s.amountCents)} save />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="mt-3 border-t border-[#2a2a30] pt-3"><Row label="Pay via PayPal" value={fmt(due)} strong /></div>
            </div>

            {/* approve */}
            <div className="mt-8">
              {paid != null ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md rounded-xl border border-[#15e08a]/30 bg-[#15e08a]/8 p-4 font-mono-stack text-[12.5px] leading-relaxed text-[#8fe9c4]">
                  ✓ Sandbox capture: <b className="text-[#15e08a]">{fmt(paid)}</b> approved via PayPal. In the live app this is a real sandbox Payout + a signed Ed25519 receipt.
                  <button onClick={replay} className="ml-2 underline opacity-70 hover:opacity-100">replay</button>
                </motion.div>
              ) : done ? (
                <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.15 }} onClick={() => setPaid(result.payNowCents)}
                  className="group relative inline-flex h-[60px] items-center gap-3 overflow-hidden rounded-xl bg-[#15e08a] px-7 text-[16px] font-semibold text-[#06281c] shadow-[0_18px_50px_-14px_rgba(21,224,138,.6)] transition-transform hover:-translate-y-0.5">
                  <motion.span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" animate={{ x: ["0%", "420%"] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }} />
                  <Image src="/brand/repal-monogram.png" alt="" width={20} height={20} className="h-5 w-5" />
                  Approve {fmt(result.payNowCents)} with PayPal
                </motion.button>
              ) : (
                <div className="font-mono-stack text-[12.5px] uppercase tracking-[0.2em] text-[#6c675d]">{status}</div>
              )}
            </div>
          </section>

          {/* ── RIGHT: the physical stack engine ── */}
          <section className="relative">
            <div className="rounded-[28px] border border-[#1e1e24] bg-[#0d0d11]/80 p-6 shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] backdrop-blur">
              {/* status line */}
              <div className="flex items-center justify-between font-mono-stack text-[11px] uppercase tracking-[0.18em]">
                <span className="text-[#8f897d]">Your RePal wallet</span>
                <span className="text-[#6c675d]">{DEMO_WALLET.length} rewards</span>
              </div>

              {/* wallet grid — scanning */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {DEMO_WALLET.map((w) => {
                  const used = usedIds.has(w.id); const reason = skipped.get(w.id); const isChecking = checking && beatId(checking) === w.id;
                  return (
                    <motion.div key={w.id} animate={{ opacity: reason ? 0.4 : 1, scale: isChecking ? 1.06 : 1, y: isChecking ? -2 : 0 }} transition={{ duration: 0.25 }}
                      className={`relative flex h-[76px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center ${used ? "border border-dashed border-[#15e08a]/40 bg-[#15e08a]/5" : "border border-[#232329] bg-[#131318]"} ${isChecking ? "ring-2 ring-[#15e08a] shadow-[0_0_24px_-4px_#15e08a]" : ""}`}>
                      {used ? (
                        <span className="font-mono-stack text-[10.5px] uppercase tracking-wide text-[#15e08a]">✓ Stacked</span>
                      ) : (
                        <>
                          <motion.div layoutId={`chip-${w.id}`} transition={SPRING}><MerchantLogo domain={w.domain} name={w.merchantName ?? w.label} size={24} /></motion.div>
                          <span className={`font-mono-stack text-[12px] font-bold leading-none ${reason ? "text-[#6c675d] line-through" : "text-[#ece6da]"}`}>{short(w)}</span>
                          <span className="w-full truncate font-mono-stack text-[9px] uppercase tracking-wide text-[#6c675d]">{w.kind}</span>
                        </>
                      )}
                      {reason && <span className="absolute -rotate-[14deg] rounded border border-[#c6613f]/50 px-1.5 py-0.5 font-mono-stack text-[8.5px] uppercase tracking-wider text-[#c6613f]">void</span>}
                      {isChecking && <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl" style={{ background: "linear-gradient(180deg,transparent,rgba(21,224,138,.18),transparent)" }} initial={{ y: "-100%" }} animate={{ y: "100%" }} transition={{ duration: beatMs * 0.42 / 1000, ease: "linear" }} />}
                    </motion.div>
                  );
                })}
              </div>

              {/* status text */}
              <div className="mt-3 h-5 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={status} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }}
                    className={`truncate font-mono-stack text-[11.5px] ${checking?.kind === "skip" ? "text-[#c6613f]" : "text-[#8f897d]"}`}>{status}</motion.div>
                </AnimatePresence>
              </div>

              {/* the physical stack */}
              <div className="relative mt-4 h-[180px]">
                <AnimatePresence initial={false}>
                  {!done ? applied.slice().reverse().map((s, idx) => {
                    const depth = idx; if (depth > 3) return null;
                    return (
                      <motion.div key={s.item.id} initial={{ y: -40, opacity: 0, rotate: -3 }} animate={{ y: depth * 14, opacity: 1 - depth * 0.18, scale: 1 - depth * 0.05, rotate: depth % 2 ? 1 : -1 }} exit={{ y: 40, opacity: 0 }} transition={SPRING} style={{ zIndex: 10 - depth }} className="absolute inset-x-0 top-0 origin-top">
                        <StackCard step={s} active={depth === 0} />
                      </motion.div>
                    );
                  }) : (
                    <motion.div key="paycard" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: 0.1 }} className="absolute inset-x-0 top-2">
                      <div className="rounded-2xl border border-[#15e08a]/30 bg-gradient-to-br from-[#0f1a15] to-[#0b130f] p-5 text-center">
                        <div className="font-mono-stack text-[10.5px] uppercase tracking-[0.22em] text-[#15e08a]">{applied.length} rewards stacked</div>
                        <div className="font-display-stack mt-2 text-[40px] font-semibold leading-none text-[#f3eee3]">{fmt(result.payNowCents)}</div>
                        <div className="mt-2 font-mono-stack text-[11px] text-[#8f897d]">down from {fmt(result.priceCents)} · save <span className="text-[#15e08a]">{fmt(result.savedCents)}</span></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
      </main>
    </LayoutGroup>
  );
}

function StackCard({ step, active }: { step: StackStep; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-[#15151b] p-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)] ${active ? "border-[#15e08a]/50 shadow-[0_0_40px_-10px_rgba(21,224,138,.5)]" : "border-[#232329]"}`}>
      <motion.div layoutId={`chip-${step.item.id}`} transition={SPRING}><MerchantLogo domain={step.item.domain} name={step.item.merchantName ?? step.item.label} size={40} /></motion.div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[#ece6da]">{step.item.label}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(step.checks.length ? step.checks : [{ label: "No restrictions", pass: true }]).filter((c) => c.pass).slice(0, 2).map((c) => (
            <span key={c.label} className="rounded border border-[#15e08a]/25 px-1.5 py-[1px] font-mono-stack text-[9.5px] uppercase tracking-wide text-[#15e08a]">✓ {c.label}</span>
          ))}
        </div>
      </div>
      <div className="text-right"><div className="font-display-stack text-[18px] font-semibold text-[#15e08a]">− {fmt(step.amountCents)}</div><div className="font-mono-stack text-[9px] uppercase tracking-wide text-[#6c675d]">{step.item.kind}</div></div>
    </div>
  );
}

function Row({ label, value, dim, strong, save, hint }: { label: string; value: string; dim?: boolean; strong?: boolean; save?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`truncate text-[14px] ${dim ? "text-[#6c675d]" : strong ? "font-semibold text-[#ece6da]" : "text-[#b7b1a4]"}`}>{label}{hint && <span className="ml-1.5 font-mono-stack text-[10px] uppercase tracking-wide text-[#6c675d]">· {hint}</span>}</span>
      <span className={`font-mono-stack tabular-nums ${strong ? "text-[16px] font-bold text-[#ece6da]" : save ? "text-[#15e08a]" : dim ? "text-[#6c675d]" : "text-[#b7b1a4]"}`}>{value}</span>
    </div>
  );
}
