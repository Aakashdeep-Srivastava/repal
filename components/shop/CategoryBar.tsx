"use client";

import Link from "next/link";
import { SHOP_CATEGORIES } from "@/lib/shop/categories";

/**
 * Amazon-style department nav for /shop — a horizontally scrollable row of
 * category chips. Each chip is a real link to /shop?q=<category query>, so it
 * reuses the working search path, is shareable, and survives refresh. The chip
 * matching the current query is highlighted.
 *
 * Content only; the page owns layout. See lib/shop/categories.ts for the list.
 */
export function CategoryBar({ activeQuery }: { activeQuery?: string }) {
  const active = activeQuery?.trim().toLowerCase() ?? "";
  return (
    <nav
      aria-label="Shop categories"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SHOP_CATEGORIES.map((c) => {
        const isActive = active === c.query.toLowerCase();
        return (
          <Link
            key={c.query}
            href={`/shop?q=${encodeURIComponent(c.query)}`}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            }`}
          >
            <span aria-hidden>{c.icon}</span>
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
