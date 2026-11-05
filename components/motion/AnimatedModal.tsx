"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { scaleIn, transitions } from "@/lib/motion/tokens";

export interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Centered modal over a scrim. Scales + fades in (`scaleIn`). Basic focus
 * management: the panel is focused on open, Esc closes, clicking the scrim
 * closes. (Full focus-trap cycling is left to the consumer / a dedicated
 * library; the panel is focusable via tabIndex so keyboard users land inside.)
 *
 * Reduced motion: no scale/opacity tween — the panel and scrim snap in/out while
 * remaining fully functional.
 */
export function AnimatedModal({ open, onClose, children }: AnimatedModalProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the panel on open so keyboard focus moves into the dialog.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Scrim */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : transitions.quick}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-lg)] outline-none"
            initial={reduce ? false : scaleIn.initial}
            animate={scaleIn.animate}
            exit={reduce ? { opacity: 0 } : scaleIn.exit}
            transition={reduce ? { duration: 0 } : transitions.standard}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export default AnimatedModal;
