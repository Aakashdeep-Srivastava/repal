"use client";

import { Children, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { fadeUp, transitions, stagger } from "@/lib/motion/tokens";

export interface AnimatedListProps {
  /** Array of elements, each with a STABLE key so add/remove animates correctly. */
  children: ReactNode;
  className?: string;
}

/**
 * Reveals its children in a staggered cascade (`stagger.normal` between items)
 * and animates additions/removals via AnimatePresence. Each child MUST carry a
 * stable key — Motion uses it to tell which items entered/left.
 *
 * Reduced motion: items appear/leave instantly (no transform/opacity tween, no
 * stagger delay); list membership changes are still reflected.
 */
export function AnimatedList({ children, className }: AnimatedListProps) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);

  return (
    <div className={className}>
      <AnimatePresence initial={!reduce}>
        {items.map((child, i) => {
          // Children.toArray guarantees a stable `.key` (prefixed caller key).
          const key = (child as { key?: string }).key ?? i;
          return (
            <motion.div
              key={key}
              layout={!reduce}
              initial={reduce ? false : fadeUp.initial}
              animate={fadeUp.animate}
              exit={reduce ? { opacity: 0 } : fadeUp.exit}
              transition={
                reduce
                  ? { duration: 0 }
                  : { ...transitions.standard, delay: i * stagger.normal }
              }
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default AnimatedList;
