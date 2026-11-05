"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion/tokens";

export interface AnimatedDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Edge the drawer slides in from. Defaults to "right" (desktop panels). */
  side?: "left" | "right";
}

/**
 * Side drawer for desktop contextual panels: slides in from the right (or left),
 * over a fading backdrop. Esc and backdrop click close it.
 *
 * Reduced motion: slide + fade are replaced with instant snaps; the drawer still
 * renders and functions.
 */
export function AnimatedDrawer({
  open,
  onClose,
  children,
  side = "right",
}: AnimatedDrawerProps) {
  const reduce = useReducedMotion();
  const offscreen = side === "right" ? "100%" : "-100%";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : transitions.quick}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            className={`pt-safe pb-safe absolute top-0 bottom-0 flex w-[88vw] max-w-md flex-col overflow-y-auto overscroll-contain border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lg)] ${
              side === "right" ? "right-0 border-l" : "left-0 border-r"
            }`}
            initial={reduce ? false : { x: offscreen }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: offscreen }}
            transition={reduce ? { duration: 0 } : transitions.navigation}
          >
            {children}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export default AnimatedDrawer;
