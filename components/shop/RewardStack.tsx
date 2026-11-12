// components/shop/RewardStack.tsx
// "Paying with your wallet": the agent checks every reward in the user's RePal wallet
// against THIS purchase. Usable rewards fly out of the wallet onto the stack and the
// price ticks down; ones that don't apply stay behind, greyed, with the reason.
// The stack ends in ONE PayPal payment.
//
// deps: motion (`motion/react`), @number-flow/react. Every number comes from computeStack().
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import type { Stackable, StackResult, StackStep } from "@/lib/stack/compute";
import { fmt } from "@/lib/stack/compute";
import { MerchantLogo } from "@/components/rewards/MerchantLogo";

type Beat =
  | { kind: "apply"; step: StackStep }
  | { kind: "skip"; item: Stackable; reason: string };

const EASE = [0.22, 1, 0.36, 1] as const;     // no bounce on money
const SPRING = { type: "spring", stiffness: 380, damping: 36 } as const;
const usd = { style: "currency", currency: "USD" } as const;

/** Applied steps keep the calculation order (so running totals are right); skips are interleaved. */
function buildBeats(r: StackResult): Beat[] {
  const applies: Beat[] = r.steps.map((step) => ({ kind: "apply", step }));
  const skips: Beat[] = r.rejected.map((x) => ({ kind: "skip", item: x.item, reason: x.reason }));
  const out: Beat[] = [];
  while (applies.length || skips.length) {
    if (applies.length) out.push(applies.shift()!);
    if (skips.length) out.push(skips.shift()!);
  }
  return out;
}

const short = (s: Stackable) =>
  s.type === "pct_off" || s.type === "cashback_pct" ? `${s.value}%`
  : `$${Number.isInteger(s.value) ? s.value : s.value.toFixed(2)}`;
const beatId = (b: Beat) => (b.kind === "apply" ? b.step.item.id : b.item.id);

export function RewardStack({
  product, wallet, result, onPay, beatMs = 1000, autoplay = true,
}: {
  product: { name: string; merchant: string; domain: string };
  wallet: Stackable[];            // everything the user holds, in wallet order
  result: StackResult;            // computeStack(price, wallet, ctx)
  onPay?: (cents: number) => void;
  beatMs?: number;
  autoplay?: boolean;
}) {
  const beats = useMemo(() => buildBeats(result), [result]);
  const [n, setN] = useState(autoplay ? 0 : beats.length);   // beats finished
  const [scanning, setScanning] = useState(false);            // current beat is being checked
  const [run, setRun] = useState(0);
  const done = n >= beats.length;

  useEffect(() => {
    if (done) return;
    const t = scanning
      ? setTimeout(() => { setScanning(false); setN((x) => x + 1); }, beatMs * 0.45)
      : setTimeout(() => setScanning(true), n === 0 ? 600 : beatMs * 0.55);
    return () => clearTimeout(t);
  }, [n, scanning, done, beatMs, run]);

  const finished = beats.slice(0, n);
  const applied = finished.filter((b): b is Extract<Beat, { kind: "apply" }> => b.kind === "apply").map((b) => b.step);
  const skipped = new Map(finished.filter((b) => b.kind === "skip").map((b) => [beatId(b), (b as any).reason as string]));
  const usedIds = new Set(applied.map((s) => s.item.id));
  const checking = scanning && !done ? beats[n] : null;
  const last = finished[finished.length - 1];
  const due = applied.length ? applied[applied.length - 1].runningCents : result.priceCents;

  const status = done
    ? `${applied.length} of ${wallet.length} rewards fit this payment's terms`
    : checking
      ? `Checking ${beatId(checking) && (checking.kind === "apply" ? checking.step.item.label : checking.item.label)}…`
      : last
        ? last.kind === "apply" ? `✓ ${last.step.item.label}  −${fmt(last.step.amountCents)}` : `✕ ${last.item.label}: ${last.reason}`
        : `Checking ${wallet.length} rewards in your wallet…`;

  const replay = () => { setN(0); setScanning(false); setRun((r) => r + 1); };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={"stack" + run}>
        <div className="w-full max-w-[400px] overflow-hidden rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(7,50,130,.06),0_12px_40px_-12px_rgba(7,50,130,.25)] ring-1 ring-[#073282]/8">
          {/* product */}
          <div className="flex items-center gap-3">
            <MerchantLogo domain={product.domain} name={product.merchant} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-[#0b1530]">{product.name}</div>
              <div className="text-[13px] text-slate-500">{product.merchant}</div>
            </div>
            <div className={`text-[14px] tabular-nums ${applied.length ? "text-slate-400 line-through" : "text-slate-700"}`}>
              {fmt(result.priceCents)}
            </div>
          </div>

          {/* wallet */}
          <div className="mt-4 rounded-2xl bg-[#f4f7fc] p-3">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#073282]">Your RePal wallet</span>
              <span className="text-[12px] text-slate-500">{wallet.length} rewards</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {wallet.map((w) => {
                const used = usedIds.has(w.id);
                const reason = skipped.get(w.id);
                const isChecking = checking && beatId(checking) === w.id;
                return (
                  <motion.div
                    key={w.id}
                    animate={{
                      opacity: reason ? 0.42 : 1,
                      scale: isChecking ? 1.05 : 1,
                      y: isChecking ? -2 : 0,
                    }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className={`relative flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center
                      ${used ? "border border-dashed border-[#073282]/25 bg-transparent" : "bg-white ring-1"}
                      ${isChecking ? "ring-2 ring-[#04A5E2] shadow-[0_6px_18px_-8px_rgba(4,165,226,.6)]" : "ring-slate-200/80"}
                      ${reason ? "grayscale" : ""}`}
                  >
                    {used ? (
                      <span className="text-[11px] font-medium text-[#073282]/60">✓ In stack</span>
                    ) : (
                      <>
                        <motion.div layoutId={`logo-${w.id}`} transition={SPRING}>
                          <MerchantLogo domain={w.domain} name={w.merchantName ?? w.label} size={24} />
                        </motion.div>
                        <span className={`text-[13px] font-semibold leading-none tabular-nums ${reason ? "text-slate-500 line-through" : "text-[#0b1530]"}`}>
                          {short(w)}
                        </span>
                        <span className="w-full truncate text-[10.5px] leading-none text-slate-500">
                          {w.kind}
                        </span>
                      </>
                    )}
                    {isChecking && (
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent via-[#04A5E2]/15 to-transparent"
                        initial={{ y: "-100%" }} animate={{ y: "100%" }}
                        transition={{ duration: beatMs * 0.45 / 1000, ease: "linear" }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-2 h-[18px] overflow-hidden px-0.5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status}
                  initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`truncate text-[12px] ${last?.kind === "skip" && !checking && !done ? "text-rose-600" : "text-slate-500"}`}
                >
                  {status}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ticker */}
          <div className="mt-4">
            <div className="text-[12px] font-medium uppercase tracking-[.08em] text-slate-500">
              {done ? "One PayPal payment" : "You'll pay"}
            </div>
            <NumberFlow
              value={due / 100}
              format={usd}
              className="text-[40px] font-semibold leading-none tracking-tight text-[#073282] tabular-nums"
              transformTiming={{ duration: 650, easing: "cubic-bezier(.22,1,.36,1)" }}
            />
          </div>

          {/* stack */}
          <div className="relative mt-4 h-[100px]">
            <AnimatePresence initial={false}>
              {!done && applied.map((s, i) => {
                const depth = applied.length - 1 - i;
                if (depth > 3) return null;
                return (
                  <motion.div
                    key={s.item.id}
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: -depth * 12, opacity: 1 - depth * 0.2, scale: 1 - depth * 0.05 }}
                    exit={{ y: 24, opacity: 0, scale: 0.9, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                    transition={SPRING}
                    className="absolute inset-x-0 bottom-0 origin-top"
                    style={{ zIndex: 10 - depth }}
                  >
                    <StackCard step={s} active={depth === 0} />
                  </motion.div>
                );
              })}
              {done && (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.3 }}
                  className="absolute inset-x-0 bottom-0 flex flex-col gap-2"
                >
                  <button
                    onClick={() => onPay?.(result.payNowCents)}
                    className="relative h-[54px] w-full overflow-hidden rounded-2xl bg-[#073282] text-[16px] font-semibold text-white active:scale-[.99]"
                  >
                    <motion.span
                      aria-hidden
                      className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      animate={{ x: ["0%", "400%"] }}
                      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
                    />
                    Approve {fmt(result.payNowCents)} with PayPal
                  </button>
                  <div className="text-center text-[12.5px] text-slate-500 tabular-nums">
                    {applied.length} wallet rewards stacked · you save <b className="text-emerald-600">{fmt(result.savedCents)}</b>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ledger */}
          <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
            <Row label="Price" value={fmt(result.priceCents)} muted />
            <AnimatePresence initial={false}>
              {applied.map((s) => (
                <motion.div
                  key={"l" + s.item.id}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <Row label={s.item.label} hint={s.item.kind} value={"−" + fmt(s.amountCents)} tone="save" />
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="mt-2 border-t border-slate-100 pt-2">
              <Row label="Pay via PayPal" value={fmt(due)} strong />
            </div>
          </div>

          {done && (
            <button onClick={replay} className="mt-3 w-full text-[12px] text-slate-400 hover:text-slate-600">
              Replay
            </button>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

function StackCard({ step, active }: { step: StackStep; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ${active ? "ring-[#04A5E2]/50 shadow-[0_8px_24px_-10px_rgba(4,165,226,.45)]" : "ring-slate-200"}`}>
      <motion.div layoutId={`logo-${step.item.id}`} transition={SPRING}>
        <MerchantLogo domain={step.item.domain} name={step.item.merchantName ?? step.item.label} size={40} />
      </motion.div>
      <div className="min-w-0 flex-1" title={step.item.clause}>
        <div className="truncate text-[14px] font-semibold text-[#0b1530]">{step.item.label}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(step.checks.length ? step.checks : [{ label: "No restrictions", pass: true }]).map((c) => (
            <span key={c.label} className="rounded-md bg-emerald-50 px-1.5 py-[1px] text-[10.5px] font-medium text-emerald-700">
              ✓ {c.label}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-semibold tabular-nums text-emerald-600">−{fmt(step.amountCents)}</div>
        <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{step.item.kind}</div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, strong, tone, hint }: {
  label: string; value: string; muted?: boolean; strong?: boolean; tone?: "save"; hint?: string;
}) {
  const color = tone === "save" ? "text-emerald-600" : strong ? "text-[#073282]" : "text-slate-600";
  return (
    <div className="flex items-baseline justify-between py-1 text-[13.5px]">
      <span className={`truncate ${muted ? "text-slate-400" : strong ? "font-semibold text-[#0b1530]" : "text-slate-600"}`}>
        {label}{hint && <span className="ml-1.5 text-[11px] text-slate-400">· {hint}</span>}
      </span>
      <span className={`tabular-nums ${strong ? "text-[15px] font-semibold" : ""} ${color}`}>{value}</span>
    </div>
  );
}
