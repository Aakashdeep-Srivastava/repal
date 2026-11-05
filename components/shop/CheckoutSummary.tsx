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
  const appliedDiscount = plan.useRewards.reduce((sum, r) => sum + r.appliedUsd, 0);
  const rewardCount = plan.useRewards.length;

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

      {/* Conditional / future rewards — kept SEPARATE from the savings above. */}
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
        <span className="font-medium text-[var(--color-fg)]">Pending / future rewards:</span>{" "}
        none — this plan applies only discounts that are confirmed now.
      </div>

      {/* Payment method. */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
        <span className="text-sm text-[var(--color-muted)]">Payment method</span>
        <span className="text-sm font-medium text-[var(--color-fg)]">PayPal</span>
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
