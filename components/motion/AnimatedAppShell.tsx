"use client";

import type { ReactNode } from "react";

export interface AnimatedAppShellProps {
  /** Persistent top bar; safe-area aware (notch). Optional. */
  header?: ReactNode;
  /** Scrollable main content. */
  children: ReactNode;
  /** Persistent bottom bar (tab bar / sticky actions); safe-area aware. */
  bottomBar?: ReactNode;
  className?: string;
}

/**
 * Persistent application shell: a fixed-height flex column where the header and
 * bottom bar stay put (and clear the device safe areas) while only the middle
 * content scrolls. Mobile-first; the column simply widens on larger screens.
 *
 * This shell is intentionally NOT animated itself — it persists across route
 * changes so that page-level transitions (template.tsx / RouteTransitionBoundary)
 * run against a stable frame. No reduced-motion handling is needed here.
 */
export function AnimatedAppShell({
  header,
  children,
  bottomBar,
  className,
}: AnimatedAppShellProps) {
  return (
    <div
      className={`flex h-[100dvh] flex-col bg-[var(--color-bg)] text-[var(--color-fg)] ${
        className ?? ""
      }`}
    >
      {header ? (
        <header className="pt-safe shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          {header}
        </header>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {children}
      </main>

      {bottomBar ? (
        <nav className="pb-safe shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
          {bottomBar}
        </nav>
      ) : null}
    </div>
  );
}

export default AnimatedAppShell;
