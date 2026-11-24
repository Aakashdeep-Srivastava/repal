"use client";

import { SharedElementTransition, AnimatedNumber } from "@/components/motion";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { sharedId } from "@/lib/motion/tokens";
import type { Product, PlanWithPolicy } from "@/lib/shop/types";

/**
 * CheckoutSummary — the compact, read-only review of exactly what the user is
 * about to pay for. Every money figure here comes STRAIGHT from the optimizer's
 * winning plan (`PlanWithPolicy`); nothing is recomputed in the UI.
 *
 * - The product thumbnail reuses `sharedId.productImage(id)` so it MORPHS from
 *   the product-detail hero into this summary (shared-element continuity).
 * - "Discounts applied" is the sum of `useRewards[].appliedUsd` — the rewards
 *   that actually reduced the price now — tweened with `AnimatedNumber`.
 * - "Total payable now" is `cashUsd`, the amount PayPal (or the sandbox receipt)
 *   will attest to. It is the single most prominent number.
 * - Conditional / future rewards are shown SEPARATELY and never folded into the
 *   savings total. The deterministic plan encodes only immediate discounts, so
 *   this is honestly reported as "none" rather than fabricated.
 * - The explicit confirm checkbox gates the Pay button (owned by the page); the
 *   terms line sits next to it.
 */
export interface CheckoutSummaryProps {
  plan: PlanWithPolicy;
  product: Product;
  /** Confirm-to-pay checkbox state (lifted to the page, which gates Pay). */
  confirmed: boolean;
  onConfirmedChange: (next: boolean) => void;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function CheckoutSummary({
  plan,
  product,
  confirmed,
  onConfirmedChange,
}: CheckoutSummaryProps) {
  // Instant discounts only reduce the charge now; cashback/points are deferred.
  const appliedDiscount = plan.savedUsd;
  const rewardCount = plan.useRewards.filter((r) => r.effect === "instant").length;
  const cashback = plan.cashbackUsd ?? 0;
  const points = plan.pointsUsd ?? 0;

  return (
    <div className="space-y-5">
      {/* Product line — thumbnail morphs in from the product hero. */}
      <div className="flex items-center gap-4">
        <SharedElementTransition
          layoutId={sharedId.productImage(product.id)}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)]"
        >
          <ProductVisual product={product} />
        </SharedElementTransition>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[var(--color-fg)]">
            {product.title}
          </h3>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {plan.offer.retailer}
            {product.category ? ` · ${product.category}` : ""}
          </p>
        </div>
      </div>

      {/* Money breakdown. */}
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-[var(--color-muted)]">Item price</dt>
          <dd className="tnum text-[var(--color-fg)]">{usd(plan.offer.priceUsd)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-[var(--color-muted)]">
            Discounts applied
            {rewardCount > 0 ? (
              <span className="ml-1 text-xs">
                ({rewardCount} reward{rewardCount === 1 ? "" : "s"})
              </span>
            ) : null}
          </dt>
          <dd className="text-[var(--color-teal)]">
            {appliedDiscount > 0 ? (
              <>
                −<AnimatedNumber value={appliedDiscount} />
              </>
            ) : (
              <span className="text-[var(--color-muted)]">none</span>
            )}
          </dd>
        </div>

        <div className="my-2 border-t border-[var(--color-border)]" />

        <div className="flex items-baseline justify-between">
          <dt className="font-medium text-[var(--color-fg)]">Total payable now</dt>
          <dd className="text-xl font-semibold text-[var(--color-fg)]">
            <AnimatedNumber value={plan.cashUsd} />
          </dd>
        </div>
      </dl>

      {/* Post-purchase value — kept SEPARATE; never folded into "payable now". */}
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
        {cashback > 0 || points > 0 ? (
          <>
            <span className="font-medium text-[var(--color-fg)]">After purchase:</span>{" "}
            {cashback > 0 && <>≈ {usd(cashback)} cashback / statement credit</>}
            {cashback > 0 && points > 0 && " · "}
            {points > 0 && <>~{usd(points)} points value (redemption-dependent)</>}
            {" "}— doesn&apos;t reduce today&apos;s charge.
          </>
        ) : (
          <>
            <span className="font-medium text-[var(--color-fg)]">Pending / future rewards:</span>{" "}
            none — this plan applies only discounts that are confirmed now.
          </>
        )}
      </div>

      {/* Payment method — PayPal is the sole funding source. */}
      <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.04] px-3.5 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-xs font-bold text-white">
          PP
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-fg)]">PayPal</p>
          <p className="text-xs text-[var(--color-muted)]">
            Pay securely from your PayPal balance, card, or bank.
          </p>
        </div>
      </div>

      {/* Terms + explicit confirm. */}
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action)]"
          aria-label="I confirm this order and agree to the terms"
        />
        <span className="text-[var(--color-muted)]">
          I confirm this order and agree to RePal&apos;s terms. I understand the
          total above is what will be charged.
        </span>
      </label>
    </div>
  );
}

export default CheckoutSummary;
