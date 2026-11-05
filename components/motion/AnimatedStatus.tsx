"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { duration, easing, transitions } from "@/lib/motion/tokens";

export type StatusTone = "info" | "progress" | "success" | "warning" | "error";

export interface AnimatedStatusProps {
  /** Machine state id — drives the cross-fade when it changes. */
  status: string;
  /** Human-readable label shown in the pill. */
  label: string;
  tone: StatusTone;
  className?: string;
}

const TONE_STYLES: Record<StatusTone, string> = {
  info: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]",
  progress: "border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]",
  success: "border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 text-[var(--color-teal)]",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  error: "border-red-500/40 bg-red-500/10 text-red-500",
};

/**
 * Continuous-rotation period for the progress ring. Derived from the token scale
 * (not a transition duration) so a calm ~0.9s revolution shares one source of
 * timing rather than hard-coding a number.
 */
const SPIN_PERIOD = duration.complex * 2;

/** Calm rotating ring shown ONLY for the "progress" tone. Because it unmounts
 * on any terminal tone (success/warning/error/info), the rotation stops as soon
 * as the state machine settles — never an indefinite distracting loop. */
function ProgressRing({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={
        reduce
          ? undefined
          : { repeat: Infinity, ease: easing.standard, duration: SPIN_PERIOD }
      }
    />
  );
}

/**
 * Animated status pill for a state machine. Changing `status` cross-fades the
 * label; `tone` recolors it. Tabular text keeps width stable. Announced to
 * assistive tech via role="status" + aria-live="polite".
 *
 * Reduced motion: no cross-fade and no ring rotation — the pill updates
 * instantly and the progress ring renders static (still a visible indicator).
 */
export function AnimatedStatus({
  status,
  label,
  tone,
  className,
}: AnimatedStatusProps) {
  const reduce = useReducedMotion();

  return (
    <span
      role="status"
      aria-live="polite"
      className={`tnum inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${TONE_STYLES[tone]} ${
        className ?? ""
      }`}
    >
      {tone === "progress" ? <ProgressRing reduce={!!reduce} /> : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
          transition={reduce ? { duration: 0 } : transitions.quick}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default AnimatedStatus;
