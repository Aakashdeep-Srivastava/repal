"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { MotionButton, AnimatedNumber } from "@/components/motion";
import { useJourney } from "@/lib/store/journey";
import { transitions } from "@/lib/motion/tokens";
import type { PlanWithPolicy } from "@/lib/shop/types";

/**
 * ReceiptCard — the verified outcome, shown only AFTER a server-signed receipt
 * exists (`isPaymentSuccess`). It is the honest record of what happened:
 *
 *  - PAID amount is `cashUsd` (what the receipt attests PayPal moved, or in
 *    sandbox what the signed receipt records — no live capture).
 *  - Applied discounts is `savedUsd` (actually applied, not future/conditional).
 *  - Future / conditional rewards are shown SEPARATELY and never merged in.
 *  - The transaction reference is the real `receiptId` from the server.
 *  - The "verified" badge is earned ONLY because the server returned a signed
 *    receipt id; in sandbox it reads "(sandbox)" so it is never mistaken for a
 *    live capture.
 *
 * The receipt rises in (fade+scale) so it reads as the status "becoming" a
 * receipt; reduced motion shows it immediately.
 */
export interface ReceiptCardProps {
  plan: PlanWithPolicy;
  receiptId: string;
  /** True for the sandbox (demo) receipt — labels the badge accordingly. */
  demo: boolean;
}

export function ReceiptCard({ plan, receiptId, demo }: ReceiptCardProps) {
  const router = useRouter();
  const reset = useJourney((s) => s.reset);
  const reduce = useReducedMotion();

  function backToDashboard() {
    reset();
    router.push("/");
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : transitions.standard}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)]/15 text-[var(--color-teal)]"
          >
            ✓
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-fg)]">
              {demo ? "Sandbox receipt issued" : "Payment complete"}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">{plan.offer.title}</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-teal)]">
          {demo ? "Signed receipt ✓ (sandbox)" : "Signed receipt ✓ verified"}
        </span>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-[var(--color-muted)]">Paid</dt>
          <dd className="text-xl font-semibold text-[var(--color-fg)]">
            <AnimatedNumber value={plan.cashUsd} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[var(--color-muted)]">Discounts applied</dt>
          <dd className="text-[var(--color-teal)]">
            {plan.savedUsd > 0 ? (
              <>
                −<AnimatedNumber value={plan.savedUsd} />
              </>
            ) : (
              <span className="text-[var(--color-muted)]">none</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[var(--color-muted)]">Pending / future rewards</dt>
          <dd className="text-[var(--color-muted)]">none</dd>
        </div>
        <div className="my-2 border-t border-[var(--color-border)]" />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[var(--color-muted)]">Reference</dt>
          <dd className="truncate font-mono text-xs text-[var(--color-fg)]" title={receiptId}>
            {receiptId}
          </dd>
        </div>
      </dl>

      {demo ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          Sandbox — no live PayPal capture. The receipt is genuine and verifiable,
          but no money moved.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <MotionButton onClick={() => router.push(`/verify/${receiptId}`)}>
          View receipt
        </MotionButton>
        <MotionButton
          onClick={backToDashboard}
          className="!bg-transparent !text-[var(--color-fg)] !shadow-none ring-1 ring-[var(--color-border)]"
        >
          Back to dashboard
        </MotionButton>
        <MotionButton
          onClick={() => router.push("/wallet")}
          className="!bg-transparent !text-[var(--color-fg)] !shadow-none ring-1 ring-[var(--color-border)]"
        >
          View savings history
        </MotionButton>
      </div>
    </motion.div>
  );
}

export default ReceiptCard;
