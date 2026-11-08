"use client";

import AgentSearchLoader, { type AgentStep } from "@/components/AgentSearchLoader";

/**
 * First-run onboarding — shown on the wallet when a logged-in user has no
 * rewards yet. Consent-first: nothing is read until the user taps "Find my
 * rewards", and the copy is explicit about read-only, reward-only scanning
 * (the privacy model behind the email/SMS sources). While importing, it shows
 * the AgentSearchLoader (the Terms agent reading each reward's fine print).
 */

const INGEST_STEPS: AgentStep[] = [
  { label: "Collecting from your sources", detail: "Email, cards, loyalty, PayPal", estimateMs: 2200 },
  { label: "Reading terms & conditions", detail: "Caps, exclusions, expiry", estimateMs: 3400 },
  { label: "Normalizing & saving rewards", detail: "Building your wallet", estimateMs: 1800 },
];

const SOURCES = [
  { icon: "✉️", label: "Email", note: "gift cards & receipts" },
  { icon: "💳", label: "Cards", note: "statement cashback" },
  { icon: "🎟️", label: "Loyalty", note: "points & vouchers" },
  { icon: "🅿️", label: "PayPal", note: "balance & offers" },
];

export function Onboarding({
  name,
  importing,
  onImport,
}: {
  name?: string;
  importing: boolean;
  onImport: () => void;
}) {
  if (importing) {
    return (
      <div className="mt-8 flex justify-center">
        <AgentSearchLoader title="Finding your rewards" steps={INGEST_STEPS} />
      </div>
    );
  }

  const first = name?.trim().split(/\s+/)[0];

  return (
    <div className="rise mt-8 overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm sm:p-8">
      <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-mono text-xs tracking-wide text-[var(--color-brand)]">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
        Welcome to RePal
      </p>

      <h2 className="font-display mt-4 text-2xl font-medium leading-tight tracking-tight text-[var(--color-fg)] sm:text-3xl">
        {first ? `Hi ${first} — let's find your rewards.` : "Let's find your rewards."}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        You already have rewards scattered across email, cards, and loyalty programs. RePal
        pulls them into one wallet, reads the fine print, and finds the cheapest price after
        rewards.
      </p>

      {/* Sources we can connect — framed as read-only, reward-only. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SOURCES.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-start gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
          >
            <span className="text-lg" aria-hidden>
              {s.icon}
            </span>
            <span className="text-sm font-medium text-[var(--color-fg)]">{s.label}</span>
            <span className="text-xs text-[var(--color-muted)]">{s.note}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
        <span aria-hidden>🔒</span>
        <span>
          <span className="font-medium text-[var(--color-fg)]">Read-only &amp; reward-only.</span>{" "}
          RePal scans only for reward-related messages — never your whole inbox — and you can
          disconnect any source anytime.
        </span>
      </p>

      <button
        onClick={onImport}
        className="mt-6 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 sm:w-auto"
      >
        Find my rewards
      </button>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Demo mode imports a labelled sample set so you can explore instantly — no accounts
        connected.
      </p>
    </div>
  );
}

export default Onboarding;
