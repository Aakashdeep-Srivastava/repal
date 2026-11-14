"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { fetchMandate, createMandate, revokeMandate, type MandateInput } from "@/lib/client";
import { DashboardShell, I, usd } from "@/components/dashboard/shell";

/* presets */
type PresetKey = "conservative" | "balanced" | "flexible";
const PRESETS: Record<PresetKey, { label: string; tag?: string; sub: string; icon: (c: string) => React.ReactNode; cap: number; budget: number; thr: number }> = {
  conservative: { label: "Conservative", sub: "Lower limits, tighter approvals.", icon: (c) => <I.shield className={c} />, cap: 100, budget: 500, thr: 50 },
  balanced: { label: "Balanced", tag: "Popular", sub: "Moderate limits and approvals.", icon: (c) => <I.scale className={c} />, cap: 200, budget: 1000, thr: 100 },
  flexible: { label: "Flexible", sub: "Higher limits, broader permissions.", icon: (c) => <I.bolt className={c} />, cap: 500, budget: 2500, thr: 250 },
};
const CATEGORIES = ["electronics", "groceries", "dining", "travel", "fashion", "home", "audio", "beauty"];
const MERCHANTS = ["Best Buy", "Amazon", "Target", "Walmart", "Apple", "Nike"];

const STEPS = ["Limits", "Permissions", "Review & Authorize"];

function Stepper({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return (
    <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1 sm:gap-4">
      {STEPS.map((label, i) => {
        const n = i + 1; const done = n < step; const active = n === step;
        return (
          <div key={label} className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button onClick={() => n <= step && onStep(n)} disabled={n > step} className="flex items-center gap-2 disabled:cursor-default">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold ${active ? "bg-[var(--color-brand)] text-white" : done ? "bg-emerald-500 text-white" : "border border-[var(--color-border)] text-[var(--color-muted)]"}`}>{done ? <I.check className="h-3.5 w-3.5" /> : n}</span>
              <span className={`whitespace-nowrap text-[13.5px] font-medium ${active ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-[var(--color-border)] sm:w-14" />}
          </div>
        );
      })}
    </div>
  );
}

function Slider({ icon, label, hint, value, min, max, step, onChange }: { icon: React.ReactNode; label: string; hint?: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-[14px] font-medium text-[var(--color-fg)]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">{icon}</span>{label}{hint && <span className="text-[11px] text-[var(--color-muted)]">· {hint}</span>}</div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5"><span className="text-[13px] text-[var(--color-muted)]">$</span><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className="w-16 bg-transparent text-right text-[14px] font-semibold text-[var(--color-fg)] outline-none" /></div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none" style={{ background: `linear-gradient(90deg, var(--color-brand) ${pct}%, color-mix(in oklab, var(--color-fg) 12%, transparent) ${pct}%)` }} />
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--color-muted)]"><span>{usd(min)}</span><span>{usd(max)}</span></div>
    </div>
  );
}

function LivePreview({ cap, budget, thr, cats, merch, status }: { cap: number; budget: number; thr: number; cats: string[]; merch: string[]; status: string }) {
  const row = (icon: React.ReactNode, a: string, b: string) => (
    <div className="flex items-center gap-3 py-1.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">{icon}</span><span className="text-[13.5px] text-[var(--color-muted)]">{a} <b className="text-[var(--color-fg)]">{b}</b></span></div>
  );
  return (
    <aside className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm lg:sticky lg:top-2">
      <div className="flex items-center justify-between"><h3 className="text-[15.5px] font-semibold text-[var(--color-fg)]">Live Mandate Preview</h3><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{status}</span></div>
      <div className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">What your agent can do</div>
      <div className="mt-1">
        {row(<I.cart className="h-4 w-4" />, "Spend up to", `${usd(cap)} per purchase`)}
        {row(<I.coin className="h-4 w-4" />, "Spend up to", `${usd(budget)} per month`)}
        {row(<I.bell className="h-4 w-4" />, "Ask you for approval above", usd(thr))}
      </div>
      {(cats.length > 0 || merch.length > 0) && (
        <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Allowed</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{[...cats, ...merch].map((c) => <span key={c} className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11.5px] text-[var(--color-fg)] ring-1 ring-[var(--color-border)]">{c}</span>)}</div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/5 p-3">
        <Image src="/brand/repal-monogram.png" alt="" width={28} height={28} className="h-7 w-7" />
        <div className="text-[12px] leading-snug"><b className="text-[var(--color-fg)]">Powered by PayPal Vault</b><span className="block text-[var(--color-muted)]">A real, revocable payment token that keeps you in control.</span></div>
      </div>
    </aside>
  );
}

const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick} className={`rounded-full px-3.5 py-2 text-[13px] font-medium capitalize transition-colors ${on ? "bg-[var(--color-brand)] text-white shadow-sm" : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}>{label}</button>
);

export function MandateStudio() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: active, isLoading } = useQuery({ queryKey: ["mandate"], queryFn: fetchMandate, retry: false });

  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [cap, setCap] = useState(200);
  const [budget, setBudget] = useState(1000);
  const [thr, setThr] = useState(100);
  const [cats, setCats] = useState<string[]>([]);
  const [merch, setMerch] = useState<string[]>([]);

  // hydrate from an existing active mandate
  useEffect(() => {
    if (active) { setCap(active.capUsd); setBudget(active.budgetUsd); setThr(active.approvalThresholdUsd); setCats(active.allowCategories ?? []); setMerch(active.allowMerchants ?? []); }
  }, [active]);

  const applyPreset = (k: PresetKey) => { setPreset(k); setCap(PRESETS[k].cap); setBudget(PRESETS[k].budget); setThr(PRESETS[k].thr); };
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const create = useMutation({
    mutationFn: async () => {
      const input: MandateInput = { capUsd: cap, budgetUsd: budget, approvalThresholdUsd: thr, allowCategories: cats, allowMerchants: merch, expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString() };
      return createMandate(input);
    },
    onSuccess: (r) => { if (r.approveUrl) { window.location.href = r.approveUrl; return; } qc.invalidateQueries({ queryKey: ["mandate"] }); setStep(4); },
  });
  const revoke = useMutation({ mutationFn: () => revokeMandate(active!.id), onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate"] }) });

  const status = useMemo(() => (step === 4 ? "Active" : "In Draft"), [step]);

  return (
    <DashboardShell title="Mandate Studio" subtitle="Configure your AI agent's spending authority with PayPal.">
      <Stepper step={Math.min(step, 3)} onStep={setStep} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* LEFT — step content */}
        <div className="min-w-0 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          {active && step < 4 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/5 p-3.5">
              <div className="flex items-center gap-2 text-[13.5px] text-[var(--color-fg)]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]"><I.shield className="h-4 w-4" /></span>You have an active mandate{active.paypalVaultTokenId ? " — Vault-backed" : ""}. Editing will replace it.</div>
              <button onClick={() => revoke.mutate()} disabled={revoke.isPending} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-[12.5px] font-medium text-rose-600 hover:bg-rose-500/8 disabled:opacity-60">{revoke.isPending ? "Revoking…" : "Revoke"}</button>
            </div>
          )}

          {step === 1 && (
            <>
              <span className="inline-block rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-[12px] font-medium text-[var(--color-brand)]">Step 1 of 3 · Set your limits</span>
              <h2 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-[var(--color-fg)]">Set your spending comfort zone.</h2>
              <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">You decide how much RePal can spend. Your agent cannot exceed these limits.</p>

              <div className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Choose a preset <span className="font-normal normal-case">(optional)</span></div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
                  const pp = PRESETS[k]; const on = preset === k;
                  return (
                    <button key={k} onClick={() => applyPreset(k)} className={`relative rounded-2xl border p-4 text-left transition-colors ${on ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]" : "border-[var(--color-border)] hover:border-[var(--color-brand)]/40"}`}>
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">{pp.icon("h-5 w-5")}</span>
                      <div className="mt-2.5 flex items-center gap-2"><span className="text-[14px] font-semibold text-[var(--color-fg)]">{pp.label}</span>{pp.tag && <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-semibold text-white">{pp.tag}</span>}</div>
                      <p className="mt-1 text-[12.5px] leading-snug text-[var(--color-muted)]">{pp.sub}</p>
                      {on && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)] text-white"><I.check className="h-3 w-3" /></span>}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <Slider icon={<I.cart className="h-4 w-4" />} label="Maximum per purchase" value={cap} min={50} max={1000} step={10} onChange={(v) => { setCap(v); setPreset((p) => p); }} />
                <Slider icon={<I.coin className="h-4 w-4" />} label="Total budget" hint="per month" value={budget} min={200} max={5000} step={50} onChange={setBudget} />
                <Slider icon={<I.bell className="h-4 w-4" />} label="Ask me above" value={thr} min={50} max={500} step={10} onChange={setThr} />
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><I.shield className="h-4 w-4" /></span><p className="text-[13px] leading-snug text-[var(--color-muted)]"><b className="text-[var(--color-fg)]">Your control, your rules.</b> Every purchase is checked against your signed spending policy. Purchases requiring approval wait for you.</p></div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="inline-block rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-[12px] font-medium text-[var(--color-brand)]">Step 2 of 3 · Permissions</span>
              <h2 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-[var(--color-fg)]">Where can your agent shop?</h2>
              <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">Optionally restrict to specific categories and merchants. Leave empty to allow all.</p>
              <div className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Allowed categories</div>
              <div className="mt-2 flex flex-wrap gap-2">{CATEGORIES.map((c) => <Toggle key={c} on={cats.includes(c)} label={c} onClick={() => toggle(cats, setCats, c)} />)}</div>
              <div className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Allowed merchants</div>
              <div className="mt-2 flex flex-wrap gap-2">{MERCHANTS.map((m) => <Toggle key={m} on={merch.includes(m)} label={m} onClick={() => toggle(merch, setMerch, m)} />)}</div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]"><I.sparkle className="h-4 w-4" /></span><p className="text-[13px] leading-snug text-[var(--color-muted)]">No restrictions set means the agent can shop anywhere — still bounded by your spend limits and approval threshold.</p></div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="inline-block rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-[12px] font-medium text-[var(--color-brand)]">Step 3 of 3 · Review & Authorize</span>
              <h2 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-[var(--color-fg)]">Review & authorize your agent.</h2>
              <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">This creates a revocable PayPal Vault token your agent spends against — never more than your limits.</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[["Max per purchase", usd(cap)], ["Total budget / mo", usd(budget)], ["Ask me above", usd(thr)]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"><dt className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{k}</dt><dd className="mt-1 text-[18px] font-semibold text-[var(--color-fg)]">{v}</dd></div>
                ))}
              </dl>
              {(cats.length > 0 || merch.length > 0) && <div className="mt-3 flex flex-wrap gap-1.5">{[...cats, ...merch].map((c) => <span key={c} className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11.5px] capitalize text-[var(--color-fg)] ring-1 ring-[var(--color-border)]">{c}</span>)}</div>}
              {create.isError && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[13px] text-rose-600">{create.error instanceof Error ? create.error.message : "Could not create the mandate."}</p>}
            </>
          )}

          {step === 4 && (
            <div className="grid place-items-center py-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/12 text-emerald-600"><I.check className="h-8 w-8" /></span>
              <h2 className="font-display mt-4 text-[24px] font-semibold text-[var(--color-fg)]">Mandate active 🎉</h2>
              <p className="mt-1.5 max-w-sm text-[14px] text-[var(--color-muted)]">Your agent can now shop within {usd(cap)}/purchase and {usd(budget)}/month, asking you above {usd(thr)}.</p>
              <div className="mt-5 flex gap-3"><button onClick={() => router.push("/shop")} className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white">Start shopping →</button><button onClick={() => router.push("/wallet")} className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)]">Back to wallet</button></div>
            </div>
          )}

          {/* footer nav */}
          {step < 4 && (
            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-5">
              <button onClick={() => (step === 1 ? router.push("/wallet") : setStep(step - 1))} className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)]">{step === 1 ? "Cancel" : "Back"}</button>
              {step < 3 ? (
                <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white">Continue to {STEPS[step]} <I.arrow className="h-4 w-4" /></button>
              ) : (
                <button onClick={() => create.mutate()} disabled={create.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Image src="/brand/repal-monogram.png" alt="" width={18} height={18} className="h-4 w-4" />{create.isPending ? "Authorizing…" : "Authorize agent"}</button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — live preview */}
        {step < 4 && <LivePreview cap={cap} budget={budget} thr={thr} cats={cats} merch={merch} status={isLoading ? "Loading" : active ? "Active" : status} />}
      </div>
    </DashboardShell>
  );
}
