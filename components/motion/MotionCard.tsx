"use client";

import { forwardRef, type ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion/tokens";

export type MotionCardProps = ComponentProps<typeof motion.div> & {
  /** When provided, the card becomes a button-like, clickable surface. */
  onClick?: ComponentProps<typeof motion.div>["onClick"];
};

/**
 * Card surface on `--color-card` with a `--color-border` edge and `--radius-lg`.
 * On hover-capable devices it lifts slightly and raises its shadow. When
 * `onClick` is set it also presses on tap and exposes a button role.
 *
 * Reduced motion: no lift/press (shadow + border stay static); fully functional.
 */
export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  function MotionCard({ className, onClick, children, ...rest }, ref) {
    const reduce = useReducedMotion();
    const clickable = typeof onClick === "function";
    const interactive = !reduce;

    return (
      <motion.div
        ref={ref}
        onClick={onClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)] ${
          clickable ? "cursor-pointer" : ""
        } ${className ?? ""}`}
        whileHover={
          interactive
            ? { y: -2, boxShadow: "var(--shadow-md)" }
            : undefined
        }
        whileTap={interactive && clickable ? { scale: 0.99 } : undefined}
        transition={transitions.quick}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);

export default MotionCard;
