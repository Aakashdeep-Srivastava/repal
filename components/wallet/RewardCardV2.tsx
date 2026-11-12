"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { MerchantLogo } from "@/components/rewards/MerchantLogo";
import { payoutReward, type WalletReward } from "@/lib/client";

/**
 * RewardCardV2 — the dashboard reward card (design: "RePal Rewards Wallet").
 *
 * A clean, tactile card: a real merchant logo, a value-forward header, the
 * AI-parsed fine print, an urgency-tinted expiry chip, and a cash-out arrow that
 * liberates the reward into real PayPal balance. Provenance is honest — sample
 * data is labelled "Sample"; parse confidence is shown on hover of the shield.
 *
 * Display-only: `valueUsd` is shown verbatim; no money is computed here.
 */

const MERCHANTS: { re: RegExp; domain: string; name: string }[] = [
  { re: /target/i, domain: "target.com", name: "Target" },
  { re: /\bnike\b/i, domain: "nike.com", name: "Nike" },
  { re: /best ?buy/i, domain: "bestbuy.com", name: "Best Buy" },
  { re: /chase/i, domain: "chase.com", name: "Chase" },
  { re: /starbucks/i, domain: "starbucks.com", name: "Starbucks" },
  { re: /amazon/i, domain: "amazon.com", name: "Amazon" },
  { re: /rakuten/i, domain: "rakuten.com", name: "Rakuten" },
  { re: /aliexpress/i, domain: "aliexpress.com", name: "AliExpress" },
  { re: /amex|american express/i, domain: "americanexpress.com", name: "Amex" },
  { re: /\bvisa\b/i, domain: "visa.com", name: "Visa" },
  { re: /discover/i, domain: "discover.com", name: "Discover" },
  { re: /mastercard/i, domain: "mastercard.com", name: "Mastercard" },
  { re: /\bdell\b/i, domain: "dell.com", name: "Dell" },
  { re: /paypal/i, domain: "paypal.com", name: "PayPal" },
];

function merchantOf(reward: WalletReward): { domain: string; name: string } {
  const hit = MERCHANTS.find((m) => m.re.test(reward.termsRaw));
  if (hit) return { domain: hit.domain, name: hit.name };
  return { domain: "", name: reward.source === "sample" ? "Reward" : reward.source };
}

const TYPE_LABEL: Record<string, string> = {
  giftcard: "Gift Card", gift_card: "Gift Card", points: "Points", cashback: "Cashback",
  coupon: "Coupon", voucher: "Voucher", credit: "Store Credit", percent: "% back",
};
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
const usd = (n: number) => `$${n.toFixed(n % 1 === 0 ? 2 : 2)}`;

function headline(reward: WalletReward): string {
  if (reward.type === "points") {
    const pts = reward.termsRaw.match(/([\d,]+)\s*(?:stars?|points?|pts)/i);
    if (pts) return `${pts[1]} pts`;
  }
  if (reward.valueUsd > 0) return usd(reward.valueUsd);
  const pct = reward.termsRaw.match(/(\d+(?:\.\d+)?)\s*%/);
  return pct ? `${pct[1]}%` : "—";
}

type ExpiryTone = "expired" | "urgent" | "soon" | "far";
function expiry(iso: string): { label: string; tone: ExpiryTone } {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return { label: "No expiry", tone: "far" };
  if (days < 0) return { label: "Expired", tone: "expired" };
  if (days === 0) return { label: "Expires today", tone: "urgent" };
  if (days <= 3) return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "urgent" };
  if (days <= 31) return { label: `Expires in ${days} days`, tone: "soon" };
  return { label: `Expires ${new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`, tone: "far" };
}
const EXPIRY_STYLE: Record<ExpiryTone, string> = {
  expired: "text-rose-600 bg-rose-500/10",
  urgent: "text-rose-600 bg-rose-500/10",
  soon: "text-amber-600 bg-amber-500/10",
  far: "text-[var(--color-muted)] bg-[var(--color-bg)]",
};

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RewardCardV2({
  reward, index, defaultEmail, onCashedOut,
}: {
  reward: WalletReward;
  index: number;
  defaultEmail?: string;
  onCashedOut?: () => void;
}) {
  const m = merchantOf(reward);
  const exp = expiry(reward.expiresAt);
  const isSample = reward.source === "sample" || reward.source === "seed";
  const dead = reward.status === "expired" || reward.status === "used" || exp.tone === "expired";
  const liberated = reward.status === "liberated";
  const confPct = Math.round(reward.parseConfidence * 100);
  const canCashOut = !dead && !liberated && reward.valueUsd > 0 && reward.status === "active";

  const [mode, setMode] = useState<"idle" | "form" | "busy" | "done" | "error">("idle");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function cashOut() {
    if (!email.trim()) { setMode("error"); setMsg("Enter the PayPal email to receive the cash."); return; }
    setMode("busy"); setMsg(null);
    try {
      const r = await payoutReward({ rewardId: reward.id, receiverEmail: email.trim(), amountUsd: reward.valueUsd });
      setVerifyUrl(r.verifyUrl); setMode("done"); onCashedOut?.();
    } catch (e) {
      setMode("error"); setMsg(e instanceof Error ? e.message : "Cash-out failed.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: dead ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(11,18,32,.04),0_10px_30px_-18px_rgba(11,18,32,.25)] transition-shadow hover:shadow-[0_1px_2px_rgba(11,18,32,.05),0_18px_40px_-20px_rgba(36,87,230,.35)]"
    >
      {/* header */}
      <div className="flex items-start gap-3">
        <MerchantLogo domain={m.domain} name={m.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="tnum text-[1.65rem] font-semibold leading-none tracking-tight text-[var(--color-fg)]">
            {headline(reward)}
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-[var(--color-muted)]">{typeLabel(reward.type)}</div>
        </div>
        {isSample && (
          <span className="shrink-0 rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)] ring-1 ring-[var(--color-border)]">
            Sample
          </span>
        )}
      </div>

      {/* fine print */}
      <p className="mt-4 line-clamp-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        {reward.termsRaw}
      </p>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${EXPIRY_STYLE[exp.tone]}`}>
          <ClockIcon />
          {exp.label}
        </span>

        {liberated ? (
          <span className="text-[12px] font-medium text-emerald-600">✓ Cashed out</span>
        ) : canCashOut ? (
          <button
            onClick={() => setMode((x) => (x === "idle" ? "form" : "idle"))}
            aria-label="Cash out to PayPal"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-brand)] transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          confPct > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]" title={`AI read this reward's fine print with ${confPct}% confidence`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l7 3v6c0 4.5-3 8-7 11-4-3-7-6.5-7-11V5l7-3z" fill="currentColor" opacity="0.18" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              AI · {confPct}%
            </span>
          )
        )}
      </div>

      {/* cash-out inline panel */}
      {canCashOut && mode !== "idle" && (
        <div className="mt-4 border-t border-dashed border-[var(--color-border)] pt-3">
          {mode === "done" ? (
            <p className="text-[12px] text-emerald-600">
              ✓ Cashed out {usd(reward.valueUsd)}
              {verifyUrl && (<>{" · "}<a href={verifyUrl} className="underline">receipt</a></>)}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sandbox buyer email"
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-xs outline-none focus:border-[var(--color-brand)]"
              />
              {mode === "error" && msg && <p className="text-xs text-rose-500">{msg}</p>}
              <div className="flex gap-2">
                <button
                  onClick={cashOut}
                  disabled={mode === "busy"}
                  className="flex-1 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {mode === "busy" ? "Sending…" : `Cash out ${usd(reward.valueUsd)} →`}
                </button>
                <button onClick={() => setMode("idle")} className="rounded-lg px-3 py-2 text-xs text-[var(--color-muted)]">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
