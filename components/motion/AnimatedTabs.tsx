"use client";

import { motion, useReducedMotion, LayoutGroup } from "motion/react";
import { useId } from "react";
import { sharedSpring } from "@/lib/motion/tokens";

export interface AnimatedTab {
  id: string;
  label: string;
}

export interface AnimatedTabsProps {
  tabs: AnimatedTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Tab bar with a single underline that slides between tabs via a shared
 * `layoutId` (the `sharedSpring` morph). `useId` namespaces the layoutId so
 * multiple tab bars on one page don't share one indicator.
 *
 * Reduced motion: the underline still moves to the active tab, but with
 * `layout` disabled it jumps instantly instead of sliding.
 */
export function AnimatedTabs({
  tabs,
  active,
  onChange,
  className,
}: AnimatedTabsProps) {
  const reduce = useReducedMotion();
  const groupId = useId();

  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        className={`flex items-center gap-1 border-b border-[var(--color-border)] ${
          className ?? ""
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {tab.label}
              {isActive ? (
                <motion.span
                  layoutId="active-tab-underline"
                  layout={!reduce}
                  transition={reduce ? { duration: 0 } : sharedSpring}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-brand)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export default AnimatedTabs;
