"use client";

import type { ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { AnimatedPage } from "./AnimatedPage";

export interface RouteTransitionBoundaryProps {
  children: ReactNode;
}

/**
 * Cross-fades route changes by keying an <AnimatePresence mode="wait"> on the
 * current pathname: the outgoing page plays its `exit`, then the incoming page
 * plays its `enter`.
 *
 * Next.js App Router caveat
 * -------------------------
 * The App Router streams the new route's RSC payload and swaps the subtree
 * WITHOUT unmounting a shared parent, so Motion never sees the old child leave
 * on its own. Keying on `usePathname()` is what forces that unmount/remount,
 * giving AnimatePresence a stable boundary to animate. This component must live
 * inside a client boundary and wrap only the swappable page content — NOT the
 * persistent shell/layout. Because `mode="wait"` holds the old page until its
 * exit finishes, keep exit durations short (we use `transitions.exit`-scale
 * timing via AnimatedPage) to avoid a laggy-feeling navigation. For the global
 * page-enter mechanism prefer `app/template.tsx`, which remounts per navigation
 * for free; use this boundary when you explicitly want the outgoing page to
 * animate OUT as well.
 */
export function RouteTransitionBoundary({ children }: RouteTransitionBoundaryProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <AnimatedPage key={pathname}>{children}</AnimatedPage>
    </AnimatePresence>
  );
}

export default RouteTransitionBoundary;
