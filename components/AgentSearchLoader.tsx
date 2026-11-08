"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RepalLoader from "@/components/brand/RepalLoader";

/**
 * AgentSearchLoader — "agent is working" card with live time estimate.
 *
 * Auto mode (just pass steps with rough durations):
 *   <AgentSearchLoader steps={DEFAULT_STEPS} done={!isLoading} />
 *
 * Controlled mode (drive it from your SSE / tool-call events):
 *   <AgentSearchLoader steps={DEFAULT_STEPS} currentStep={i} done={finished} />
 *
 * - ETA counts down from the sum of step estimates and re-estimates as steps finish.
 * - Progress never hits 100% on its own — it eases toward ~95% and waits for `done`.
 * - If the agent overruns, the copy switches to "Almost there…" instead of showing 0s / negative.
 */

export type AgentStep = {
  label: string;        // "Reading reward T&Cs"
  detail?: string;      // optional sub-line, e.g. "17 programs"
  estimateMs: number;   // rough duration for this step
  color?: string;       // accent for this step (defaults cycle through STEP_COLORS)
};

/** Step accents — RePal brand palette: deep → brand → light-brand → cyan. */
export const STEP_COLORS = ["#103e91", "#2457e6", "#3b6cff", "#11ace3"];

export const DEFAULT_STEPS: AgentStep[] = [
  { label: "Scanning your reward wallet", detail: "Cards, points, cashback", estimateMs: 2200 },
  { label: "Reading terms & conditions", detail: "Caps, exclusions, expiry", estimateMs: 3200 },
  { label: "Searching live offers", detail: "Merchants & coupons", estimateMs: 3000 },
  { label: "Optimizing the cheapest plan", detail: "Price after rewards", estimateMs: 2400 },
];

type Props = {
  steps?: AgentStep[];
  title?: string;
  query?: string;           // echoes what the user asked
  currentStep?: number;     // controlled mode
  done?: boolean;
  onDone?: () => void;
  className?: string;
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

export default function AgentSearchLoader({
  steps = DEFAULT_STEPS,
  title = "RePal is working on it",
  query,
  currentStep,
  done = false,
  onDone,
  className = "",
}: Props) {
  const total = useMemo(() => steps.reduce((a, s) => a + s.estimateMs, 0), [steps]);
  const start = useRef<number>(0);
  const stepStart = useRef<number>(0);
  const [now, setNow] = useState(0);
  const [autoStep, setAutoStep] = useState(0);
  const took = useRef<number[]>([]);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    start.current = stepStart.current = performance.now();
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const controlled = currentStep !== undefined;
  const active = done ? steps.length : Math.min(controlled ? currentStep! : autoStep, steps.length - 1);

  // auto-advance in uncontrolled mode
  useEffect(() => {
    if (controlled || done || !start.current) return;
    if (autoStep < steps.length - 1 && now - stepStart.current >= steps[autoStep].estimateMs) {
      took.current[autoStep] = now - stepStart.current;
      stepStart.current = now;
      setAutoStep((s) => s + 1);
    }
  }, [now, autoStep, controlled, done, steps]);

  const prevStep = useRef(0);
  useEffect(() => {
    if (!controlled) return;
    const t = performance.now();
    for (let i = prevStep.current; i < currentStep!; i++) took.current[i] ??= t - stepStart.current;
    prevStep.current = currentStep!;
    stepStart.current = t;
  }, [currentStep, controlled]);
  useEffect(() => {
    if (!done) { endAt.current = null; return; }
    endAt.current = performance.now();
    const last = Math.min(controlled ? currentStep! : autoStep, steps.length - 1);
    took.current[last] ??= performance.now() - stepStart.current;
    onDone?.();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── estimate ─────────────────────────────────────────────
  const elapsed = start.current ? (endAt.current ?? now) - start.current : 0;
  const doneMs = steps.slice(0, Math.min(active, steps.length)).reduce((a, s) => a + s.estimateMs, 0);
  const inStep = start.current ? now - stepStart.current : 0;
  const cur = steps[Math.min(active, steps.length - 1)];
  const stepFrac = done ? 1 : Math.min(inStep / cur.estimateMs, 1);
  const raw = done ? 1 : (doneMs + stepFrac * cur.estimateMs) / total;
  // ease toward 95% and wait for real completion
  const progress = done ? 1 : Math.min(0.95, raw * 0.95 + (stepFrac >= 1 ? 0.01 * Math.log1p(inStep / 1000) : 0));
  const remaining = total - doneMs - Math.min(inStep, cur.estimateMs);
  const overrun = !done && stepFrac >= 1;
  const pct = Math.round(progress * 100);
  const colorOf = (i: number) => steps[i]?.color ?? STEP_COLORS[i % STEP_COLORS.length];
  const activeColor = colorOf(Math.min(active, steps.length - 1));
  // hard-stop gradient: one colour band per step, sized by its estimate
  let acc = 0;
  const bands = steps.map((s, i) => {
    const a0 = (acc / total) * 95; acc += s.estimateMs;
    const a1 = i === steps.length - 1 ? 100 : (acc / total) * 95;
    return `${colorOf(i)} ${a0}% ${a1}%`;
  }).join(",");

  return (
    <div
      className={`asl ${done ? "asl--done" : ""} ${className}`}
      role="status"
      aria-live="polite"
      style={{ ["--c" as string]: done ? STEP_COLORS[0] : activeColor }}
    >
      <style>{CSS}</style>

      <div className="asl-head">
        <div className="asl-mark">
          <span className="asl-halo" />
          <RepalLoader size={44} speed={2.2} label="Agent working" filled={done} />
        </div>
        <div className="asl-titles">
          <div className="asl-title">{done ? "Done — here's your plan" : <span className="asl-shimmer">{title}</span>}</div>
          {query && <div className="asl-query">“{query}”</div>}
        </div>
        <div className="asl-eta" aria-label="Estimated time remaining">
          <span key={done ? "d" : overrun ? "o" : fmt(remaining)} className={`asl-eta-num ${overrun ? "asl-eta-num--sm" : ""}`}>
            {done ? "Done" : overrun ? "Almost" : fmt(remaining)}
          </span>
          <span className="asl-eta-cap">{done ? `in ${(elapsed / 1000).toFixed(1)}s` : overrun ? "there…" : "remaining"}</span>
        </div>
      </div>

      <div className="asl-bar" aria-hidden>
        <div
          className="asl-fill"
          style={{ background: `linear-gradient(90deg,${bands})`, clipPath: `inset(0 ${100 - pct}% 0 0 round 99px)` }}
        >
          <span className="asl-sheen" />
        </div>
        <span className="asl-head-dot" style={{ left: `${pct}%` }} />
        {steps.slice(1).map((_, i) => {
          const at = steps.slice(0, i + 1).reduce((a, s) => a + s.estimateMs, 0) / total;
          return <span key={i} className="asl-tick" style={{ left: `${at * 95}%` }} />;
        })}
      </div>
      <div className="asl-meta">
        <span>Step {Math.min(active + 1, steps.length)} of {steps.length}</span>
        <span>{pct}%</span>
      </div>

      <ol className="asl-steps">
        {steps.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "todo";
          return (
            <li
              key={s.label}
              className={`asl-step asl-step--${state}`}
              style={{ animationDelay: `${i * 70}ms`, ["--sc" as string]: colorOf(i) }}
            >
              <span className="asl-icon">
                {state === "done" ? (
                  <svg viewBox="0 0 24 24" width="14" height="14"><path className="asl-check" d="M5 12.5l4.2 4.2L19 7" /></svg>
                ) : state === "active" ? <span className="asl-spin" /> : <span className="asl-dot" />}
              </span>
              <span className="asl-step-text">
                <span className="asl-step-label">{s.label}{state === "active" && <span className="asl-ell" />}</span>
                {s.detail && <span className="asl-step-detail">{s.detail}</span>}
              </span>
              {state === "done" && <span className="asl-step-time">{(( took.current[i] ?? s.estimateMs) / 1000).toFixed(1)}s</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const CSS = `
.asl{--ink:var(--color-fg);--mute:var(--color-muted);--line:var(--color-border);--card:var(--color-card);
  position:relative;width:100%;max-width:440px;padding:18px 18px 14px;border-radius:var(--radius-2xl,20px);background:var(--card);
  border:1px solid var(--line);box-shadow:0 1px 2px rgba(7,58,147,.06),0 12px 32px -12px rgba(7,58,147,.25);
  font:500 14px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);overflow:hidden;
  animation:asl-in .45s cubic-bezier(.2,.8,.2,1) both}
.asl::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;pointer-events:none;
  background:conic-gradient(from var(--a,0deg),transparent 0 70%,var(--c) 88%,transparent);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;
  animation:asl-orbit 3.2s linear infinite;opacity:.9}
.asl--done::before{animation:none;opacity:0;transition:opacity .4s}
@property --a{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes asl-orbit{to{--a:360deg}}
@keyframes asl-in{from{opacity:0;transform:translateY(8px) scale(.98)}}

.asl-head{display:flex;align-items:center;gap:12px}
.asl-mark{position:relative;width:44px;height:44px;flex:none;display:grid;place-items:center}
.asl-halo{position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c) 35%,transparent),transparent 65%);transition:background .5s;animation:asl-breathe 2.2s ease-in-out infinite}
@keyframes asl-breathe{50%{transform:scale(1.18);opacity:.5}}
.asl-titles{flex:1;min-width:0}
.asl-title{font-weight:650;font-size:15px;letter-spacing:-.01em}
.asl-shimmer{background:linear-gradient(90deg,var(--ink) 0 35%,var(--c) 50%,var(--ink) 65% 100%);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:asl-shim 2.4s linear infinite}
@keyframes asl-shim{from{background-position:100% 0}to{background-position:-150% 0}}
.asl-query{color:var(--mute);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}

.asl-eta{text-align:right;display:flex;flex-direction:column;align-items:flex-end;min-width:76px}
.asl-eta-num{font:700 20px/1 ui-sans-serif,system-ui;font-variant-numeric:tabular-nums;letter-spacing:-.02em;
  color:var(--c);transition:color .4s;
  animation:asl-flip .35s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes asl-flip{from{opacity:0;transform:translateY(-6px) rotateX(70deg)}}
.asl-eta-num--sm{font-size:16px}
.asl--done .asl-eta-num{font-size:16px}
.asl-eta-cap{font-size:11px;color:var(--mute);margin-top:3px;text-transform:uppercase;letter-spacing:.06em}

.asl-bar{position:relative;height:8px;margin-top:16px;border-radius:99px;background:color-mix(in oklab,var(--color-fg) 9%,transparent);overflow:visible}
.asl-fill{position:absolute;inset:0;border-radius:inherit;transition:clip-path .35s linear;overflow:hidden}
.asl-sheen{position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.55) 50%,transparent 80%);
  transform:translateX(-100%);animation:asl-sheen 1.6s ease-in-out infinite}
@keyframes asl-sheen{to{transform:translateX(100%)}}
.asl-head-dot{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%);transition:left .35s linear;
  background:#fff;border:2px solid var(--c);box-shadow:0 0 12px 3px color-mix(in srgb,var(--c) 60%,transparent);animation:asl-pulse 1.2s ease-in-out infinite}
@keyframes asl-pulse{50%{box-shadow:0 0 18px 6px color-mix(in srgb,var(--c) 35%,transparent)}}
.asl--done .asl-head-dot,.asl--done .asl-sheen{display:none}
.asl-tick{position:absolute;top:0;width:2px;height:8px;background:var(--card);transform:translateX(-1px)}
.asl-meta{display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--mute);font-variant-numeric:tabular-nums}

.asl-steps{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:2px}
.asl-step{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:12px;animation:asl-in .4s both;transition:background .3s,opacity .3s}
.asl-step{position:relative}
.asl-step--active{background:linear-gradient(90deg,color-mix(in srgb,var(--sc) 12%,transparent),transparent)}
.asl-step--active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--sc)}
.asl-step--todo{opacity:.45}
.asl-icon{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:50%}
.asl-step--done .asl-icon{background:var(--sc);box-shadow:0 2px 8px -2px color-mix(in srgb,var(--sc) 70%,transparent);animation:asl-pop .35s cubic-bezier(.2,.9,.3,1.5)}
@keyframes asl-pop{from{transform:scale(.4)}}
.asl-check{fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22;animation:asl-tickdraw .35s .1s ease-out forwards}
@keyframes asl-tickdraw{to{stroke-dashoffset:0}}
.asl-spin{width:16px;height:16px;border-radius:50%;border:2px solid color-mix(in srgb,var(--sc) 20%,transparent);border-top-color:var(--sc);border-right-color:var(--sc);animation:asl-rot .7s linear infinite}
@keyframes asl-rot{to{transform:rotate(360deg)}}
.asl-dot{width:7px;height:7px;border-radius:50%;background:var(--sc);opacity:.45}
.asl-step-text{flex:1;min-width:0;display:flex;flex-direction:column}
.asl-step-label{font-weight:600;font-size:13.5px}
.asl-step--active .asl-step-label{color:var(--sc)}
.asl-step-detail{font-size:11.5px;color:var(--mute)}
.asl-step-time{font-size:11px;color:var(--mute);font-variant-numeric:tabular-nums}
.asl-ell::after{content:"";animation:asl-dots 1.2s steps(4) infinite}
@keyframes asl-dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}

@media (prefers-reduced-motion:reduce){.asl *,.asl::before{animation:none!important;transition:none!important}
  .asl-check{stroke-dashoffset:0}}
`;
