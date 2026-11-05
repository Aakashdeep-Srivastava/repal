"use client";

import { forwardRef, type ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion/tokens";

export type MotionButtonProps = ComponentProps<typeof motion.button>;

/**
 * Button primitive: subtle press (scale 0.97 on tap) and a small hover lift on
 * hover-capable devices (Motion's `whileHover` only fires for real pointer
 * hover, so touch devices never get a stuck hover state). Enforces a 44×44px
 * minimum touch target and uses the brand action color by default.
 *
 * Disabled-safe: when `disabled`, press/hover animations are suppressed. Forwards
 * all native button props, ref, and merges `className`.
 *
 * Reduced motion: no scale/lift — the button still responds to clicks normally.
 */
export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  function MotionButton({ className, disabled, children, ...rest }, ref) {
    const reduce = useReducedMotion();
    const interactive = !disabled && !reduce;

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-action)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-brand-deep)] disabled:cursor-not-allowed disabled:opacity-50 ${
          className ?? ""
        }`}
        whileTap={interactive ? { scale: 0.97 } : undefined}
        whileHover={interactive ? { y: -1 } : undefined}
        transition={transitions.micro}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);

export default MotionButton;
