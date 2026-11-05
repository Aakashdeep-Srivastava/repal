"use client";

import { useEffect, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useDragControls,
  type PanInfo,
} from "motion/react";
import { transitions } from "@/lib/motion/tokens";

export interface AnimatedBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

/** Drag-to-dismiss thresholds (px / px·s⁻¹). Not motion timing — these are
 * gesture distances/velocities, so a literal value is correct here. */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

/**
 * Mobile bottom sheet: slides up from the bottom edge, draggable downward to
 * dismiss, with a fading backdrop and body-scroll lock while open.
 *
 * Drag vs. scroll: the panel is a motion element but `dragListener` is OFF, so
 * dragging is initiated ONLY from the grab handle via `useDragControls`. That
 * leaves the inner content region (overflow-y-auto) free to scroll natively —
 * the two gestures never fight. `dragConstraints` pin the top at 0 and
 * `dragElastic` only yields downward, so the sheet can be pulled down but not up.
 *
 * Dismissal: on drag end we close if the sheet was pulled past DISMISS_OFFSET
 * (120px) OR flicked faster than DISMISS_VELOCITY (800px/s) — a fast flick
 * dismisses even on a short drag; otherwise it springs back.
 *
 * Body scroll lock: while `open`, document.body overflow is set to hidden and
 * restored on close/unmount, so the page behind the sheet doesn't scroll.
 *
 * Reduced motion: the slide/backdrop fade are replaced with instant snaps (the
 * sheet and scrim still render and remain fully functional, including drag).
 */
export function AnimatedBottomSheet({
  open,
  onClose,
  children,
  title,
}: AnimatedBottomSheetProps) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();

  // Lock body scroll while the sheet is open; always restore on cleanup.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={reduce ? { duration: 0 } : transitions.quick}
            onClick={onClose}
          />

          {/* Sheet panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Sheet"}
            className="pb-safe relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sheet)]"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
            transition={reduce ? { duration: 0 } : transitions.navigation}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
          >
            {/* Grab handle — the ONLY drag initiator, so content can scroll. */}
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-2 pt-3 pb-2 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span
                aria-hidden
                className="h-1.5 w-10 rounded-full bg-[var(--color-border)]"
              />
              {title ? (
                <h2 className="px-4 text-base font-semibold text-[var(--color-fg)]">
                  {title}
                </h2>
              ) : null}
            </div>

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export default AnimatedBottomSheet;
