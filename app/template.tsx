import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { AnimatedPage } from "@/components/motion/AnimatedPage";

/**
 * Next.js template — unlike a layout, this component RE-MOUNTS on every
 * navigation. That remount is the global page-enter mechanism: each new route
 * gets a fresh <AnimatedPage> that plays its fade+rise `enter`.
 *
 * - <MotionConfig reducedMotion="user"> makes the whole subtree honor the OS
 *   "reduce motion" setting without every component re-checking it.
 * - This is a transparent wrapper: no padding, margin, or layout box of its
 *   own, so it introduces zero layout shift around page content.
 * - SSR-safe: MotionConfig + the initial AnimatedPage render deterministically
 *   on the server (no window / Date.now / random in the render path).
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatedPage>{children}</AnimatedPage>
    </MotionConfig>
  );
}
