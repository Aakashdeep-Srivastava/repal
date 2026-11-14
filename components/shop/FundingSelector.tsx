"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mark } from "@/components/dashboard/shell";
import { selectFunding, type FundingSource, type FundingOption } from "@/lib/paypal/funding";

/**
 * FundingSelector — the agentic-commerce moment at checkout: the agent doesn't
 * just pay, it *chooses how* to pay the stacked lowest price. It surfaces the
 * agent's recommended PayPal funding method (instant balance, Venmo, or Pay
 * Later) with a plain-language reason, and lets the user override in one tap.
 *
 * The decision is deterministic (lib/paypal/funding.selectFunding) — a pure
 * function of the amount — so it's explainable and never an LLM guess. The
 * selected `FundingSource` is lifted to the page and handed to PaymentFlow,
 * which passes it to Orders v2 as the `payment_source`.
 */
export interface FundingSelectorProps {
  amountUsd: number;
  value: FundingSource | null;
  onChange: (next: FundingSource) => void;
}

export function FundingSelector({ amountUsd, value, onChange }: FundingSelectorProps) {
  const choice = useMemo(() => selectFunding(amountUsd), [amountUsd]);

  // Before the user touches anything, the agent's pick is the active selection.
  const selected: FundingSource = value ?? choice.chosen.source;
  const overridden = value != null && value !== choice.chosen.source;

  // All three methods, chosen first, in a stable order for the chip row.
  const all: FundingOption[] = [choice.chosen, ...choice.alternatives];

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.04] p-3.5">
      {/* Agent header + reason */}
      <div className="flex items-start gap-2.5">
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]">
          <Mark className="h-4 w-4 brightness-0 invert" />
          <span className="absolute inset-0 rounded-full ring-2 ring-[var(--color-brand)]/30 animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--color-fg)]">
            {overridden ? "Your funding choice" : "Agent picked your funding"}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={selected}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18 }}
              className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]"
            >
              {overridden
                ? `You chose ${labelOf(all, selected)}. The agent recommended ${choice.chosen.label}.`
                : choice.reason}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Method chips — one tap to override the agent's pick. */}
      <div className="grid grid-cols-3 gap-2">
        {all.map((o) => {
          const active = o.source === selected;
          const isAgentPick = o.source === choice.chosen.source;
          return (
            <button
              key={o.source}
              type="button"
              onClick={() => onChange(o.source)}
              aria-pressed={active}
              className={[
                "relative flex flex-col items-center gap-1 rounded-[var(--radius-md)] border px-2 py-2.5 text-center transition-colors",
                active
                  ? "border-[var(--color-brand)] bg-[var(--color-card)] shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-card)]/60 hover:border-[var(--color-brand)]/40",
              ].join(" ")}
            >
              {isAgentPick ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-brand)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                  Agent
                </span>
              ) : null}
              <span className="text-lg leading-none" aria-hidden>
                {o.emoji}
              </span>
              <span className="text-[11px] font-medium leading-tight text-[var(--color-fg)]">
                {o.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail line for the active method. */}
      <p className="text-[11px] text-[var(--color-muted)]">
        {all.find((o) => o.source === selected)?.detail}
      </p>
    </div>
  );
}

function labelOf(all: FundingOption[], s: FundingSource): string {
  return all.find((o) => o.source === s)?.label ?? s;
}

export default FundingSelector;
