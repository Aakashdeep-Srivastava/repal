"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fadeUp, transitions } from "@/lib/motion/tokens";

export interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content and fades + rises it in on mount, fading out on exit.
 * When used under an <AnimatePresence> (see RouteTransitionBoundary) the exit
 * variant animates on route change.
 *
 * Reduced motion: snaps straight to the final (animate) state — no transform or
 * opacity tween — while still rendering content and participating in presence.
 */
export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : fadeUp.initial}
      animate={fadeUp.animate}
      exit={reduce ? { opacity: 1 } : fadeUp.exit}
      transition={reduce ? { duration: 0 } : transitions.enter}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedPage;
