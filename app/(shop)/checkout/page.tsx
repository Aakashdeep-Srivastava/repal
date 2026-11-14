"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MotionButton, MotionCard, AnimatedBottomSheet } from "@/components/motion";
import { CheckoutSummary } from "@/components/shop/CheckoutSummary";
import { PaymentFlow } from "@/components/shop/PaymentFlow";
import { ReceiptCard } from "@/components/shop/ReceiptCard";
import { useJourney } from "@/lib/store/journey";
import { isPaymentSuccess, type PaymentStatus } from "@/lib/shop/types";
import type { FundingSource } from "@/lib/paypal/funding";

/**
 * /checkout — the review → pay → receipt route. Content only; the persistent
 * shop shell (header/search) and page enter/exit come from the layout/template.
 *
 * Presentation is responsive:
 *  - lg+  : a centered contextual panel (summary + pay).
 *  - < lg : an AnimatedBottomSheet, open by default, expandable toward full
 *           height, with the pay action sticky at the bottom (pb-safe).
 * The mobile/desktop choice is made AFTER mount (matchMedia) so SSR and the
 * first client render agree (no hydration mismatch) — desktop is the stable
 * default and the sheet refines in.
 *
 * Success is swapped IN PLACE: once a server-signed receipt exists the summary
 * and pay controls are replaced by the verified ReceiptCard on the same route.
 */

/** Transient in-flight states that must not survive a refresh without a receipt. */
const TRANSIENT: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  "idle",
  "preparing",
  "awaiting_approval",
  "capturing",
  "verifying",
]);

export default function CheckoutPage() {
  const selectedProduct = useJourney((s) => s.selectedProduct);
  const selectedPlan = useJourney((s) => s.selectedPlan);
  const payment = useJourney((s) => s.payment);
  const receiptId = useJourney((s) => s.receiptId);
  const beginCheckout = useJourney((s) => s.beginCheckout);

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  // null = defer to the agent's recommendation (FundingSelector resolves it);
  // once the user taps a method it becomes an explicit override.
  const [funding, setFunding] = useState<FundingSource | null>(null);

  // Mark mounted so we don't flash the empty state before the persisted store
  // (sessionStorage) has hydrated on a mid-checkout refresh.
  useEffect(() => setMounted(true), []);

  // Responsive: resolve after mount, keep in sync on resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Environment probe → live vs. demo path + the prominent badge.
  useEffect(() => {
    let alive = true;
    fetch("/api/pay/mode")
      .then((r) => r.json())
      .then((d: { paypalConfigured?: boolean }) => {
        if (alive) setMode(d.paypalConfigured ? "live" : "demo");
      })
      .catch(() => {
        if (alive) setMode("demo"); // safest fallback: sandbox, never a fake live.
      });
    return () => {
      alive = false;
    };
  }, []);

  // Stamp a fresh checkout attempt when needed. A normal refresh with payment
  // already "review" keeps its checkoutKey (idempotent); an interrupted in-flight
  // state with no receipt is reset to "review" so the user can pay/retry cleanly.
  useEffect(() => {
    if (!mounted) return;
    const { payment: p, receiptId: rid, orderId } = useJourney.getState();
    // Returning from PayPal's approval page (?paypal=return|cancel): keep the
    // awaiting_approval state + orderId so PaymentFlow can capture / cancel it.
    const backFromPayPal =
      p === "awaiting_approval" &&
      !!orderId &&
      new URLSearchParams(window.location.search).has("paypal");
    if (TRANSIENT.has(p) && !rid && !backFromPayPal) beginCheckout();
  }, [mounted, beginCheckout]);

  // Pre-hydration: neutral placeholder (prevents a premature "nothing here").
  if (!mounted) {
    return (
      <div className="mx-auto max-w-md py-10 text-center text-sm text-[var(--color-muted)]">
        Loading checkout…
      </div>
    );
  }

  // Graceful empty state — deep-link / cleared store.
  if (!selectedProduct || !selectedPlan) {
    return (
      <MotionCard className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">
          Nothing to check out yet
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Find a product first, then pick the best plan to check out.
        </p>
        <Link href="/shop" className="mt-5 inline-block">
          <MotionButton>Browse products</MotionButton>
        </Link>
      </MotionCard>
    );
  }

  const succeeded = isPaymentSuccess(payment);
  const envBadge =
    mode === "live" ? (
      <span className="inline-flex items-center rounded-full border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-teal)]">
        Live
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
        Sandbox / Demo
      </span>
    );

  // Success: swap everything for the verified receipt (both layouts).
  if (succeeded && receiptId) {
    return (
      <div className="mx-auto max-w-lg">
        <ReceiptCard
          plan={selectedPlan}
          receiptId={receiptId}
          demo={payment === "demo_complete"}
        />
      </div>
    );
  }

  // Pay controls — rendered once mode is resolved. On mobile they sit in a
  // sticky footer so the action stays reachable while the summary scrolls.
  const payControls =
    mode === null ? (
      <p className="text-sm text-[var(--color-muted)]">Checking payment environment…</p>
    ) : (
      <PaymentFlow
        plan={selectedPlan}
        product={selectedProduct}
        mode={mode}
        funding={funding}
        disabled={!confirmed}
        onComplete={() => {
          /* receiptId + payment status are set in the store by PaymentFlow;
             this route re-renders into the ReceiptCard above. */
        }}
      />
    );

  // The shared review block (identical on desktop and mobile).
  const summaryBlock = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">Checkout</h1>
        {envBadge}
      </div>

      <CheckoutSummary
        plan={selectedPlan}
        product={selectedProduct}
        confirmed={confirmed}
        onConfirmedChange={setConfirmed}
        funding={funding}
        onFundingChange={setFunding}
      />
    </div>
  );

  // Mobile: bottom sheet (open by default). If dismissed, offer a clean reopen
  // rather than leaving a stuck sheet — and browser-back simply unmounts it.
  if (isMobile) {
    return (
      <>
        {!sheetOpen ? (
          <MotionCard className="mx-auto max-w-md p-6 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Your order is ready to review.
            </p>
            <MotionButton className="mt-4" onClick={() => setSheetOpen(true)}>
              Review &amp; pay
            </MotionButton>
          </MotionCard>
        ) : null}
        <AnimatedBottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Checkout"
        >
          {summaryBlock}
          {/* Sticky pay action: pinned to the bottom of the sheet's scroll
              viewport (the sheet itself already applies pb-safe). */}
          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 pt-4">
            {payControls}
          </div>
        </AnimatedBottomSheet>
      </>
    );
  }

  // Desktop: centered contextual panel.
  return (
    <div className="mx-auto max-w-lg">
      <MotionCard className="space-y-6 p-6">
        {summaryBlock}
        {payControls}
      </MotionCard>
    </div>
  );
}
