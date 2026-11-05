"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGroup } from "motion/react";
import { AnimatedAppShell, MotionButton } from "@/components/motion";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { useJourney } from "@/lib/store/journey";

/**
 * Persistent shell for the shopping journey (/shop, /product/[id], /checkout).
 *
 * This layout stays mounted across those route changes, so the single
 * <LayoutGroup> here gives product shared-elements (SharedElementTransition /
 * sharedId.*) a stable identity to morph against as the user moves results →
 * detail → checkout. Page-level enter/exit comes from app/template.tsx; the
 * shell itself does not animate, giving transitions a steady frame (the brief's
 * "maintain a stable app shell").
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { query, setQuery } = useJourney();
  const [text, setText] = useState(query);

  const onShopRoot = pathname === "/shop";

  function submitSearch() {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  }

  const header = (
    <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
      {onShopRoot ? (
        <Link href="/" aria-label="RePal home" className="shrink-0">
          <RepalLogo size="sm" variant="mark" />
        </Link>
      ) : (
        <MotionButton
          onClick={() => router.back()}
          aria-label="Back"
          className="shrink-0 !px-2 !py-2 !bg-transparent !text-[var(--color-fg)]"
        >
          <span aria-hidden className="text-lg">←</span>
        </MotionButton>
      )}

      {/* Docked search — always present in the shop header. */}
      <div className="flex min-w-0 flex-1 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3">
        <span aria-hidden className="mr-2 text-[var(--color-muted)]">⌕</span>
        <input
          aria-label="Search products"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitSearch()}
          placeholder="Search products…"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[var(--color-muted)]"
        />
      </div>

      <Link
        href="/wallet"
        className="shrink-0 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        Wallet
      </Link>
    </div>
  );

  return (
    <LayoutGroup>
      <AnimatedAppShell header={header}>
        <div className="mx-auto w-full max-w-5xl px-4 py-5">{children}</div>
      </AnimatedAppShell>
    </LayoutGroup>
  );
}
