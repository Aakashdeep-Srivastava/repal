"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { payoutReward, type WalletReward } from "@/lib/client";

/**
 * RewardPass — a single reward rendered as a tactile "pass" (boarding-pass /
 * Apple-Wallet motif): a source-tinted accent bar, a value-forward header, a
 * punched perforation notch, the AI-parsed fine print, and an expiry chip whose
 * urgency escalates as the deadline nears. Provenance (source) and parse
 * confidence are shown honestly — the pass never hides where a reward came from
 * or how sure the parser was.
 *
 * Display-only: `valueUsd` is shown verbatim; no money is computed here.
 */

type SourceStyle = { label: string; accent: string; soft: string };

const SOURCE: Record<string, SourceStyle> = {
  gmail: { label: "Gmail", accent: "#ea4335", soft: "rgba(234,67,53,0.12)" },
  paypal: { label: "PayPal", accent: "#0070ba", soft: "rgba(0,112,186,0.12)" },
  card: { label: "Card", accent: "#2563eb", soft: "rgba(37,99,235,0.12)" },
  loyalty: { label: "Loyalty", accent: "#d97706", soft: "rgba(217,119,6,0.12)" },
  channel3: { label: "Channel3", accent: "#0f766e", soft: "rgba(15,118,110,0.12)" },
  seed: { label: "Seed", accent: "#64748b", soft: "rgba(100,116,139,0.12)" },
};

function sourceStyle(source: string): SourceStyle {
  return SOURCE[source] ?? { ...SOURCE.seed, label: source };
}

const TYPE_LABEL: Record<string, string> = {
  giftcard: "Gift card",
  gift_card: "Gift card",
  points: "Points",
  cashback: "Cashback",
  coupon: "Coupon",
  voucher: "Voucher",
  credit: "Store credit",
  percent: "% back",
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

const usd = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;

/**
 * The headline value. Cash-like rewards show their USD value; rate rewards
 * (percent, valueUsd 0) show the actual rate parsed from the terms ("5%") rather
 * than a misleading "$0".
 */
function headlineValue(reward: WalletReward): string {
  if (reward.valueUsd > 0) return usd(reward.valueUsd);
  const pct = reward.termsRaw.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return `${pct[1]}%`;
  return "—";
}

type ExpiryTone = "expired" | "urgent" | "soon" | "far";

function expiry(iso: string): { label: string; tone: ExpiryTone } {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return { label: "no expiry", tone: "far" };
  if (days < 0) return { label: "expired", tone: "expired" };
  if (days === 0) return { label: "expires today", tone: "urgent" };
  if (days <= 3) return { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "urgent" };
  if (days <= 14) return { label: `expires in ${days} days`, tone: "soon" };
  if (days <= 31) return { label: `expires in ${days} days`, tone: "far" };
  return {
    label: `expires ${new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`,
    tone: "far",
  };
}

const EXPIRY_STYLE: Record<ExpiryTone, React.CSSProperties> = {
  expired: { color: "#dc2626", background: "rgba(220,38,38,0.10)", borderColor: "transparent" },
  urgent: { color: "#dc2626", background: "rgba(220,38,38,0.10)", borderColor: "transparent" },
  soon: { color: "#b45309", background: "rgba(217,119,6,0.12)", borderColor: "transparent" },
  far: {
    color: "var(--color-muted)",
    background: "transparent",
    borderColor: "var(--color-border)",
  },
};

export function RewardPass({
  reward,
  index,
  defaultEmail,
  onCashedOut,
}: {
  reward: WalletReward;
  index: number;
  defaultEmail?: string;
  onCashedOut?: () => void;
}) {
  const src = sourceStyle(reward.source);
  const exp = expiry(reward.expiresAt);
  const dead = reward.status === "expired" || reward.status === "used" || exp.tone === "expired";
  const liberated = reward.status === "liberated";
  const confPct = Math.round(reward.parseConfidence * 100);

  // Cash-out state machine (reward → PayPal balance).
  const canCashOut = !dead && !liberated && reward.valueUsd > 0 && reward.status === "active";
  const [mode, setMode] = useState<"idle" | "form" | "busy" | "done" | "error">("idle");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  async function cashOut() {
    if (!email.trim()) {
      setMode("error");
      setMsg("Enter the PayPal email to receive the cash.");
      return;
    }
    setMode("busy");
    setMsg(null);
    try {
      const r = await payoutReward({ rewardId: reward.id, receiverEmail: email.trim(), amountUsd: reward.valueUsd });
      setVerifyUrl(r.verifyUrl);
      setSimulated(Boolean(r.simulated));
      setMode("done");
      onCashedOut?.();
    } catch (e) {
      // Keep failures friendly — never dump a raw PayPal JSON error at the user.
      const raw = e instanceof Error ? e.message : "Cash-out failed.";
      setMode("error");
      setMsg(/failed \(\d+\)|\{.*\}/.test(raw) ? "Cash-out couldn't complete. Please try again." : raw);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: dead ? 0.62 : 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.04, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Source-tinted accent bar. */}
      <span
        aria-hidden
        className="h-1.5 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${src.accent}, ${src.accent}1a)` }}
      />

      {/* Value header. */}
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <div className="flex flex-col">
          <span className="tnum text-[1.75rem] font-semibold leading-none text-[var(--color-fg)]">
            {headlineValue(reward)}
          </span>
          <span className="mt-1.5 text-xs text-[var(--color-muted)]">{typeLabel(reward.type)}</span>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ color: src.accent, background: src.soft }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: src.accent }}
          />
          {src.label}
        </span>
      </div>

      {/* Punched perforation (ticket notch). */}
      <div className="relative my-3 h-0">
        <span
          aria-hidden
          className="absolute left-[-10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--color-bg)]"
        />
        <span
          aria-hidden
          className="absolute right-[-10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--color-bg)]"
        />
        <span
          aria-hidden
          className="absolute inset-x-5 top-1/2 border-t border-dashed border-[var(--color-border)]"
        />
      </div>

      {/* Fine print + footer. */}
      <div className="flex flex-1 flex-col px-5 pb-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-[var(--color-muted)]">
          {reward.termsRaw}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 pt-1">
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={EXPIRY_STYLE[exp.tone]}
          >
            {exp.label}
          </span>
          {confPct > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]"
              title={`RePal's AI read this reward's fine print with ${confPct}% confidence`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2l7 3v6c0 4.5-3 8-7 11-4-3-7-6.5-7-11V5l7-3z"
                  fill="currentColor"
                  opacity="0.18"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              AI-parsed · {confPct}%
            </span>
          )}
        </div>

        {/* Reward liberation — turn this reward into real PayPal balance. */}
        {liberated && (
          <p className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">
            ✓ Cashed out to PayPal
          </p>
        )}
        {canCashOut && (
          <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3">
            {mode === "done" ? (
              <div className="space-y-1">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ Cashed out {usd(reward.valueUsd)}
                  {simulated ? " (sandbox · simulated)" : ""}
                  {verifyUrl && (
                    <>
                      {" · "}
                      <a href={verifyUrl} className="underline">receipt</a>
                    </>
                  )}
                </p>
                {simulated && (
                  <p className="text-[11px] leading-snug text-[var(--color-muted)]">
                    This sandbox account can&apos;t send real PayPal payouts, so the transfer was
                    simulated — the receipt is genuine and verifiable; no real money moved.
                  </p>
                )}
              </div>
            ) : mode === "idle" ? (
              <button
                onClick={() => setMode("form")}
                className="text-xs font-medium text-[var(--color-brand)] hover:underline"
              >
                💸 Cash out to PayPal →
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sandbox buyer email"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-xs outline-none focus:border-[var(--color-brand)]"
                />
                {mode === "error" && msg && <p className="text-xs text-red-500">{msg}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={cashOut}
                    disabled={mode === "busy"}
                    className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {mode === "busy" ? "Sending…" : `Send ${usd(reward.valueUsd)}`}
                  </button>
                  <button onClick={() => setMode("idle")} className="rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)]">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default RewardPass;
