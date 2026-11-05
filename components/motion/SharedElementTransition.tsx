"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { sharedSpring } from "@/lib/motion/tokens";

export interface SharedElementTransitionProps {
  /**
   * Stable layout identity shared between two routes/surfaces so Motion morphs
   * the element from one position/size to the other. Pass ids from
   * `sharedId.*` (e.g. `sharedId.productCard(id)`) so both ends match exactly.
   */
  layoutId: string;
  children: ReactNode;
  className?: string;
}

/**
 * Thin wrapper around <motion.div layoutId> that morphs a shared element across
 * mounts using the well-damped `sharedSpring` (no visible bounce).
 *
 * Reduced motion: drops `layout`/`layoutId` so the element simply appears at its
 * destination with no morph, and uses an instant transition.
 */
export function SharedElementTransition({
  layoutId,
  children,
  className,
}: SharedElementTransitionProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div layoutId={layoutId} transition={sharedSpring} className={className}>
      {children}
    </motion.div>
  );
}

export default SharedElementTransition;
