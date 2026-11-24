"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { MerchantLogo } from "@/components/rewards/MerchantLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      <main className="hero-aura relative min-h-dvh overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
        {/* header */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/repal-monogram.png" alt="RePal" width={26} height={26} className="h-6 w-6" />
            <span className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--color-muted)]">RePal · The Stack</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/wallet" className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]">Wallet →</Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-2 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,440px)] lg:gap-16 lg:pb-24 lg:pt-8">
          {/* ── LEFT: editorial + kinetic numbers + ledger ── */}
          <section>
            <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--color-teal)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-teal)_8%,transparent)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-teal)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />Sandbox · sample rewards
            </span>

            <h1 className="font-display mt-6 max-w-2xl text-[clamp(1.55rem,2.7vw,2.1rem)] font-medium leading-[1.12] tracking-[-0.02em]">
              One tap. Every eligible reward,<br /><em className="italic text-[var(--color-brand)]">stacked into one payment.</em>
            </h1>

            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-[var(--color-muted)]">
              <MerchantLogo domain={DEMO_PRODUCT.domain} name={DEMO_PRODUCT.merchant} size={32} />
              <span className="font-semibold text-[var(--color-fg)]">{DEMO_PRODUCT.name}</span><span className="text-[var(--color-muted)]/60">·</span><span>{DEMO_PRODUCT.merchant}</span>
              <span className="ml-auto font-mono text-[13px] text-[var(--color-muted)] line-through tnum">{fmt(result.priceCents)}</span>
            </div>

            {/* the kinetic pay figure */}
            <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--color-muted)]">{done ? "One PayPal payment" : "Running total"}</div>
                <NumberFlow value={due / 100} format={{ style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }} className="font-display tnum mt-1 text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--color-fg)]" style={{ textShadow: "0 0 50px color-mix(in oklab, var(--color-brand) 16%, transparent)" }} transformTiming={{ duration: 720, easing: "cubic-bezier(.22,1,.36,1)" }} />
              </div>
              <AnimatePresence>
                {applied.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--color-muted)]">You save</div>
                    <NumberFlow value={(result.priceCents - due) / 100} format={{ style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }} className="font-display tnum mt-1 text-[clamp(1.3rem,3vw,1.85rem)] font-medium leading-none text-[var(--color-teal)]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* the ledger — receipt press */}
            <div className="mt-8 max-w-md border-t border-dashed border-[var(--color-border)] pt-5">
              <Row label="List price" value={fmt(result.priceCents)} dim />
              <AnimatePresence initial={false}>
                {applied.map((s) => (
                  <motion.div key={"l" + s.item.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
                    <Row label={s.item.label} hint={s.item.kind} value={"− " + fmt(s.amountCents)} save />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="mt-3 border-t border-[var(--color-border)] pt-3"><Row label="Pay via PayPal" value={fmt(due)} strong /></div>
            </div>

            {/* approve */}
            <div className="mt-8">
              {paid != null ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--color-teal)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-teal)_8%,transparent)] p-4 font-mono text-[12.5px] leading-relaxed text-[var(--color-fg)]">
                  <span className="text-[var(--color-teal)]">✓</span> Sandbox capture: <b className="text-[var(--color-teal)] tnum">{fmt(paid)}</b> approved via PayPal. In the live app this is a real sandbox Payout + a signed Ed25519 receipt.
                  <button onClick={replay} className="ml-2 underline opacity-70 hover:opacity-100">replay</button>
                </motion.div>
              ) : done ? (
                <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.15 }} onClick={() => setPaid(result.payNowCents)}
                  className="group relative inline-flex h-[58px] items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-brand)] px-7 text-[16px] font-semibold text-white shadow-[0_18px_44px_-14px_color-mix(in_oklab,var(--color-brand)_70%,transparent)] transition-transform hover:-translate-y-0.5">
                  <motion.span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" animate={{ x: ["0%", "420%"] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }} />
                  <Image src="/brand/repal-monogram.png" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" />
                  Approve {fmt(result.payNowCents)} with PayPal
                </motion.button>
              ) : (
                <div className="font-mono text-[12.5px] uppercase tracking-[0.18em] text-[var(--color-muted)]">{status}</div>
              )}
            </div>
          </section>

          {/* ── RIGHT: the physical stack engine ── */}
          <section className="relative">
            <div className="card rounded-[var(--radius-2xl)] p-5 shadow-[var(--shadow-lg)] sm:p-6">
              {/* status line */}
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
                <span className="text-[var(--color-muted)]">Your RePal wallet</span>
                <span className="text-[var(--color-muted)]/70">{DEMO_WALLET.length} rewards</span>
              </div>

              {/* wallet grid — scanning */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {DEMO_WALLET.map((w) => {
                  const used = usedIds.has(w.id); const reason = skipped.get(w.id); const isChecking = checking && beatId(checking) === w.id;
                  return (
                    <motion.div key={w.id} animate={{ opacity: reason ? 0.45 : 1, scale: isChecking ? 1.06 : 1, y: isChecking ? -2 : 0 }} transition={{ duration: 0.25 }}
                      className={`relative flex h-[76px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 text-center ${used ? "border border-dashed border-[color-mix(in_oklab,var(--color-teal)_45%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-teal)_8%,transparent)]" : "border border-[var(--color-border)] bg-[var(--color-bg)]"} ${isChecking ? "ring-2 ring-[var(--color-brand)] shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--color-brand)_60%,transparent)]" : ""}`}>
                      {used ? (
                        <span className="font-mono text-[10.5px] uppercase tracking-wide text-[var(--color-teal)]">✓ Stacked</span>
                      ) : (
                        <>
                          <motion.div layoutId={`chip-${w.id}`} transition={SPRING}><MerchantLogo domain={w.domain} name={w.merchantName ?? w.label} size={24} /></motion.div>
                          <span className={`font-mono text-[12px] font-bold leading-none tnum ${reason ? "text-[var(--color-muted)] line-through" : "text-[var(--color-fg)]"}`}>{short(w)}</span>
                          <span className="w-full truncate font-mono text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{w.kind}</span>
                        </>
                      )}
                      {reason && <span className="absolute -rotate-[14deg] rounded border border-[color-mix(in_oklab,var(--color-danger)_50%,var(--color-border))] bg-[var(--color-card)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-[var(--color-danger)]">void</span>}
                      {isChecking && <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)]" style={{ background: "linear-gradient(180deg,transparent,color-mix(in oklab, var(--color-brand) 16%, transparent),transparent)" }} initial={{ y: "-100%" }} animate={{ y: "100%" }} transition={{ duration: beatMs * 0.42 / 1000, ease: "linear" }} />}
                    </motion.div>
                  );
                })}
              </div>

              {/* status text */}
              <div className="mt-3 h-5 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={status} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }}
                    className={`truncate font-mono text-[11.5px] ${checking?.kind === "skip" ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>{status}</motion.div>
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
                      <div className="rounded-[var(--radius-xl)] border border-[color-mix(in_oklab,var(--color-teal)_30%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-teal)_7%,transparent)] p-5 text-center">
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-teal)]">{applied.length} rewards stacked</div>
                        <div className="font-display tnum mt-2 text-[40px] font-semibold leading-none text-[var(--color-fg)]">{fmt(result.payNowCents)}</div>
                        <div className="mt-2 font-mono text-[11px] text-[var(--color-muted)]">down from <span className="tnum">{fmt(result.priceCents)}</span> · save <span className="text-[var(--color-teal)] tnum">{fmt(result.savedCents)}</span></div>
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
    <div className={`flex items-center gap-3 rounded-[var(--radius-xl)] border bg-[var(--color-card)] p-4 shadow-[var(--shadow-md)] ${active ? "border-[color-mix(in_oklab,var(--color-teal)_50%,var(--color-border))] shadow-[0_0_40px_-12px_color-mix(in_oklab,var(--color-teal)_55%,transparent)]" : "border-[var(--color-border)]"}`}>
      <motion.div layoutId={`chip-${step.item.id}`} transition={SPRING}><MerchantLogo domain={step.item.domain} name={step.item.merchantName ?? step.item.label} size={40} /></motion.div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[var(--color-fg)]">{step.item.label}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(step.checks.length ? step.checks : [{ label: "No restrictions", pass: true }]).filter((c) => c.pass).slice(0, 2).map((c) => (
            <span key={c.label} className="rounded border border-[color-mix(in_oklab,var(--color-teal)_25%,var(--color-border))] px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-wide text-[var(--color-teal)]">✓ {c.label}</span>
          ))}
        </div>
      </div>
      <div className="text-right"><div className="font-display tnum text-[18px] font-semibold text-[var(--color-teal)]">− {fmt(step.amountCents)}</div><div className="font-mono text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{step.item.kind}</div></div>
    </div>
  );
}

function Row({ label, value, dim, strong, save, hint }: { label: string; value: string; dim?: boolean; strong?: boolean; save?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`truncate text-[14px] ${dim ? "text-[var(--color-muted)]" : strong ? "font-semibold text-[var(--color-fg)]" : "text-[var(--color-fg)]/80"}`}>{label}{hint && <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-muted)]">· {hint}</span>}</span>
      <span className={`font-mono tabular-nums ${strong ? "text-[16px] font-bold text-[var(--color-fg)]" : save ? "text-[var(--color-teal)]" : dim ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]/80"}`}>{value}</span>
    </div>
  );
}
