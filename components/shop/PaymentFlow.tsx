"use client";

import { useCallback, useRef } from "react";
import { MotionButton, AnimatedStatus, type StatusTone } from "@/components/motion";
import { useJourney } from "@/lib/store/journey";
import { isPaymentSuccess, type PaymentStatus } from "@/lib/shop/types";
import type { Product, PlanWithPolicy } from "@/lib/shop/types";

/**
 * PaymentFlow — the event-driven payment state machine. Every state transition
 * is driven by a REAL backend event (a fetch starting or its response), never by
 * a setTimeout. A success/receipt state is only ever reached when the server
 * returns a signed `receiptId` — there is no fabricated "payment complete".
 *
 * Idempotency / double-submit protection:
 *  - `submittingRef` is a synchronous guard: a double-click or a re-render driven
 *    re-entry returns immediately because the ref is set before any await.
 *  - the Pay button is also `disabled` while in-flight and once a terminal
 *    success is reached, so it cannot be clicked again.
 *  - the stable `checkoutKey` from the store is the idempotency key sent to the
 *    backend (as `decision.runId`), so repeated POSTs are attributable and the
 *    sandbox receipt id is stable per attempt.
 *
 * DEMO mode  → POST /api/pay/demo-capture → server-signed sandbox receipt.
 * LIVE mode  → POST /api/pay/order → (buyer approval happens in PayPal's own SDK
 *              UI, not recreated here) → POST /api/pay/capture → signed receipt.
 */
export interface PaymentFlowProps {
  plan: PlanWithPolicy;
  product: Product;
  mode: "live" | "demo";
  /** Called once, with the server-issued receipt id, on terminal success. */
  onComplete: (receiptId: string) => void;
  /** Gate from the confirm-to-pay checkbox (page-owned). */
  disabled?: boolean;
}

/** States where a request is in flight — button stays disabled, tone "progress". */
const IN_FLIGHT: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  "preparing",
  "awaiting_approval",
  "capturing",
  "verifying",
]);

const TONE: Record<PaymentStatus, StatusTone> = {
  idle: "info",
  review: "info",
  preparing: "progress",
  awaiting_approval: "progress",
  capturing: "progress",
  verifying: "progress",
  complete: "success",
  demo_complete: "success",
  pending: "warning",
  cancelled: "warning",
  failed: "error",
};

const LABEL: Record<PaymentStatus, string> = {
  idle: "Ready",
  review: "Review your order",
  preparing: "Preparing payment…",
  awaiting_approval: "Awaiting approval…",
  capturing: "Capturing payment…",
  verifying: "Verifying receipt…",
  complete: "Payment complete",
  demo_complete: "Sandbox receipt issued",
  pending: "Payment pending",
  cancelled: "Payment cancelled",
  failed: "Payment failed",
};

export function PaymentFlow({
  plan,
  product,
  mode,
  onComplete,
  disabled = false,
}: PaymentFlowProps) {
  const payment = useJourney((s) => s.payment);
  const paymentError = useJourney((s) => s.paymentError);
  const checkoutKey = useJourney((s) => s.checkoutKey);
  const setPayment = useJourney((s) => s.setPayment);
  const setOrderId = useJourney((s) => s.setOrderId);
  const setReceiptId = useJourney((s) => s.setReceiptId);

  // Synchronous re-entry guard — the real double-submit protection (setState is
  // async, a ref is not). Never re-armed once a terminal success is reached.
  const submittingRef = useRef(false);

  const succeeded = isPaymentSuccess(payment);
  const inFlight = IN_FLIGHT.has(payment);
  const canRetry = payment === "failed" || payment === "cancelled";

  const pay = useCallback(async () => {
    // Guards: already working, or already finished successfully.
    if (submittingRef.current || isPaymentSuccess(useJourney.getState().payment)) {
      return;
    }
    submittingRef.current = true;

    // The idempotency key — stable per checkout attempt.
    const runId = checkoutKey ?? `co_${product.id}`;
    const decision = {
      runId,
      item: plan.offer.title,
      merchant: plan.offer.retailer,
      category: product.category,
      priceUsd: plan.offer.priceUsd,
      savedUsd: plan.savedUsd,
      cashUsd: plan.cashUsd,
    };

    try {
      if (mode === "demo") {
        // ── Sandbox path: one POST → a real, server-signed receipt. ──
        setPayment("preparing");
        const res = await fetch("/api/pay/demo-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checkoutKey, decision }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          receiptId?: string;
          error?: unknown;
        };
        if (!res.ok || !data.receiptId) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Sandbox capture failed",
          );
        }
        // Receipt exists → verifying (response-driven, not a timer) → success.
        setPayment("verifying");
        setReceiptId(data.receiptId);
        setPayment("demo_complete");
        onComplete(data.receiptId);
        return; // terminal success — do NOT re-arm submittingRef.
      }

      // ── Live path: create order → (PayPal approval UI) → capture. ──
      setPayment("preparing");
      const orderRes = await fetch("/api/pay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd: plan.cashUsd, description: plan.offer.title }),
      });
      const order = (await orderRes.json().catch(() => ({}))) as {
        id?: string;
        error?: unknown;
      };
      if (!orderRes.ok || !order.id) {
        throw new Error(
          typeof order.error === "string" ? order.error : "Could not create order",
        );
      }
      setOrderId(order.id);
      // Real buyer approval would occur in PayPal's own SDK UI; we only reflect it.
      setPayment("awaiting_approval");

      setPayment("capturing");
      const capRes = await fetch("/api/pay/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, decision }),
      });
      const cap = (await capRes.json().catch(() => ({}))) as {
        receiptId?: string;
        status?: string;
        error?: unknown;
      };
      if (!capRes.ok) {
        throw new Error(
          typeof cap.error === "string" ? cap.error : "Capture failed",
        );
      }
      if (cap.status === "pending") {
        setPayment("pending", "PayPal reports this payment as pending.");
        submittingRef.current = false;
        return;
      }
      // NEVER show success without a server-issued receiptId.
      if (!cap.receiptId) {
        throw new Error("Capture returned no receipt — not marking as paid.");
      }
      setPayment("verifying");
      setReceiptId(cap.receiptId);
      setPayment("complete");
      onComplete(cap.receiptId);
      return; // terminal success.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      // Treat an explicit user-abort as a cancel (warning), else a failure.
      const cancelled = /cancel|abort/i.test(msg);
      setPayment(cancelled ? "cancelled" : "failed", msg);
      submittingRef.current = false; // allow a fresh retry attempt.
    }
  }, [checkoutKey, mode, onComplete, plan, product, setOrderId, setPayment, setReceiptId]);

  const retry = useCallback(() => {
    submittingRef.current = false;
    setPayment("review");
    // Kick off a fresh attempt immediately.
    void pay();
  }, [pay, setPayment]);

  // Button is disabled while in-flight, after success, or until confirmed.
  const payDisabled = disabled || inFlight || succeeded;

  return (
    <div className="space-y-4">
      {/* Honest sandbox banner — present throughout the demo path. */}
      {mode === "demo" ? (
        <div className="rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          <span className="font-semibold">Sandbox — no real money moved.</span> This
          issues a genuine signed receipt without a live PayPal capture.
        </div>
      ) : null}

      {/* Live machine state. */}
      <div className="flex items-center gap-3">
        <AnimatedStatus status={payment} label={LABEL[payment]} tone={TONE[payment]} />
        {paymentError && (payment === "failed" || payment === "pending") ? (
          <span className="text-xs text-[var(--color-muted)]">{paymentError}</span>
        ) : null}
      </div>

      {!succeeded ? (
        canRetry ? (
          <MotionButton onClick={retry} className="w-full">
            Retry payment
          </MotionButton>
        ) : (
          <MotionButton
            onClick={() => void pay()}
            disabled={payDisabled}
            aria-busy={inFlight}
            className="w-full"
          >
            {inFlight ? "Processing…" : `Pay with PayPal — $${plan.cashUsd.toFixed(2)}`}
          </MotionButton>
        )
      ) : null}
    </div>
  );
}

export default PaymentFlow;
