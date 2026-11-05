"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion/tokens";

export interface AnimatedNumberProps {
  value: number;
  /** Formats the (possibly fractional) interpolated value. Default: USD 2dp. */
  format?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => `$${n.toFixed(2)}`;

/**
 * Tweens a number toward `value` with NO overshoot/bounce (tween, not spring)
 * and renders it with tabular figures (`.tnum`) so width stays stable while
 * counting. Uses `useMotionValue` + `animate` + `useTransform`; the formatted
 * MotionValue is rendered directly as the span's text child.
 *
 * Reduced motion: the motion value is set instantly to `value` (final value
 * shown immediately, no tween).
 */
export function AnimatedNumber({
  value,
  format = defaultFormat,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  // Initialized to `value` so the first render shows the real number (no
  // count-up from zero on mount).
  const mv = useMotionValue(value);
  const text = useTransform(mv, (n) => format(n));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, transitions.standard);
    return () => controls.stop();
  }, [value, reduce, mv]);

  return <motion.span className={`tnum ${className ?? ""}`}>{text}</motion.span>;
}

export default AnimatedNumber;
