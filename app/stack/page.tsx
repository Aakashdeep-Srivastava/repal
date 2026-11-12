"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RewardStack } from "@/components/shop/RewardStack";
import { computeStack, fmt } from "@/lib/stack/compute";
import { DEMO_CONTEXT, DEMO_PRICE, DEMO_PRODUCT, DEMO_WALLET } from "@/lib/stack/demo";

/**
 * /stack — the "paying with your wallet" showcase. The agent checks every reward
 * the user holds against ONE purchase and stacks the ones whose terms fit into a
 * single PayPal payment; the rest stay behind with the clause that excluded them.
 *
 * Runs on the labelled SAMPLE wallet (lib/stack/demo.ts) so it works with no DB
 * and no live coupon feed — the sandbox/demo path. The money math is real and
 * deterministic (lib/stack/compute.ts, covered by compute.test.ts); only the
 * rewards are illustrative.
 */
export default function StackPage() {
  const result = useMemo(
    () => computeStack(DEMO_PRICE, DEMO_WALLET, DEMO_CONTEXT),
    [],
  );
  const [paid, setPaid] = useState<number | null>(null);

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="RePal home" className="shrink-0">
          <RepalLogo size="sm" />
        </Link>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)] sm:gap-5">
          <ThemeToggle />
          <Link href="/wallet" className="hover:text-[var(--color-fg)]">
            Wallet
          </Link>
          <Link href="/shop" className="hover:text-[var(--color-fg)]">
            Shop
          </Link>
          <Link href="/stack" className="text-[var(--color-fg)]">
            Pay
          </Link>
        </div>
      </nav>

      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-24 pt-6 lg:grid-cols-[1fr_minmax(0,400px)] lg:gap-16 lg:pt-16">
        {/* ── Left: the story ─────────────────────────────────────────── */}
        <div className="order-2 lg:order-1">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Sandbox · sample rewards
          </p>

          <h1
            className="rise font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight text-[var(--color-fg)] sm:text-5xl"
            style={{ animationDelay: "60ms" }}
          >
            One tap.
            <br />
            Every eligible reward,
            <br />
            <span className="text-[var(--color-brand)]">stacked into one payment.</span>
          </h1>

          <p
            className="rise mt-5 max-w-md text-[var(--color-muted)]"
            style={{ animationDelay: "120ms" }}
          >
            The agent reads the fine print on every reward in your RePal wallet —
            store, category, expiry, minimum spend — and applies the ones that fit
            this purchase. Coupons first, then gift cards and certificates as
            tender, then cash back. What&apos;s left is a single PayPal capture.
          </p>

          <dl
            className="rise mt-7 flex flex-wrap gap-x-8 gap-y-4"
            style={{ animationDelay: "180ms" }}
          >
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">List price</dt>
              <dd className="font-display tnum mt-1 text-2xl font-medium text-[var(--color-fg)]">
                {fmt(result.priceCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">You pay</dt>
              <dd className="font-display tnum mt-1 text-2xl font-medium text-[var(--color-brand)]">
                {fmt(result.payNowCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">You save</dt>
              <dd className="font-display tnum mt-1 text-2xl font-medium text-emerald-600 dark:text-emerald-400">
                {fmt(result.savedCents)}
              </dd>
            </div>
          </dl>

          {paid != null && (
            <p className="mt-6 rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              Sandbox capture: {fmt(paid)} approved via PayPal. In the live app this
              is a real sandbox Payout + a signed receipt.
            </p>
          )}
        </div>

        {/* ── Right: the animation ────────────────────────────────────── */}
        <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <RewardStack
            product={DEMO_PRODUCT}
            wallet={DEMO_WALLET}
            result={result}
            onPay={(cents) => setPaid(cents)}
          />
        </div>
      </div>
    </main>
  );
}
