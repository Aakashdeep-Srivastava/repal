"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  SharedElementTransition,
  AnimatedList,
  MotionButton,
} from "@/components/motion";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { RewardMapping } from "@/components/shop/RewardMapping";
import { SavingsBreakdown } from "@/components/shop/SavingsBreakdown";
import { sharedId } from "@/lib/motion/tokens";
import { useJourney } from "@/lib/store/journey";
import { fetchWallet } from "@/lib/client";
import type { Product, MerchantOffer } from "@/lib/shop/types";
import type { PlanPurchaseResult } from "@/lib/pipeline";

/**
 * /product/[id] — product DETAIL + the DESTINATION end of the shared-element
 * morph. Resolves the product from the journey store when it matches the route
 * (instant, carried from the results tap) or, on deep-link / refresh, by
 * fetching fresh details by id from /api/products/[id] (real Channel3 data or
 * the labelled sandbox) — degrading gracefully if it no longer exists.
 *
 * When a product has several merchant offers, the user picks one; eligibility is
 * evaluated against the SELECTED offer's merchant + price. Eligibility +
 * optimization come from POST /api/eligibility (wallet labels from /api/wallet);
 * the winner is plans[0]. No money is computed here — RewardMapping and
 * SavingsBreakdown only display backend values. The CTA respects policy: deny →
 * guided merchant checkout (never a fake auto-apply); ask → review & approve;
 * allow → review checkout.
 */

async function fetchProductById(id: string): Promise<Product> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Product fetch failed (${res.status})`);
  return res.json();
}

/** Evaluate rewards against the chosen merchant offer (falls back to the best). */
async function fetchEligibility(
  product: Product,
  offer?: MerchantOffer | null,
): Promise<PlanPurchaseResult> {
  const res = await fetch("/api/eligibility", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      product: {
        id: product.id,
        title: product.title,
        priceUsd: offer?.priceUsd ?? product.priceUsd,
        retailer: offer?.domain ?? product.retailer,
        buyUrl: offer?.buyUrl ?? product.buyUrl,
        category: product.category,
      },
    }),
  });
  if (!res.ok) throw new Error(`Eligibility check failed (${res.status})`);
  return res.json();
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function ProductDetailPage() {
  const router = useRouter();
  const routeId = String(useParams().id ?? "");

  const stored = useJourney((s) => s.selectedProduct);
  const selectProduct = useJourney((s) => s.selectProduct);
  const setEligibility = useJourney((s) => s.setEligibility);
  const selectPlan = useJourney((s) => s.selectPlan);

  // Prefer the store when it already holds THIS product (carried from results).
  const storedMatch = stored && stored.id === routeId ? stored : null;

  // Deep-link / refresh fallback: fetch fresh details for THIS id.
  const productQ = useQuery({
    queryKey: ["product", routeId],
    queryFn: () => fetchProductById(routeId),
    enabled: !storedMatch && !!routeId,
  });

  const product: Product | null = storedMatch ?? productQ.data ?? null;

  const resolving = !storedMatch && productQ.isLoading;
  const notFound = !product && !resolving;

  // Merchant offers for this product; the user picks one (defaults to the best).
  const offers = useMemo<MerchantOffer[]>(() => product?.offers ?? [], [product]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const selectedOffer = useMemo(
    () => offers.find((o) => o.domain === selectedDomain) ?? offers[0] ?? null,
    [offers, selectedDomain],
  );

  // Ensure the store carries the resolved product (so checkout works on deep-link).
  useEffect(() => {
    if (product && (!stored || stored.id !== product.id)) selectProduct(product);
  }, [product, stored, selectProduct]);

  // Eligibility + optimization for the resolved product + SELECTED merchant offer.
  const eligQ = useQuery({
    queryKey: ["eligibility", product?.id, selectedOffer?.domain, selectedOffer?.priceUsd],
    queryFn: () => fetchEligibility(product as Product, selectedOffer),
    enabled: !!product,
  });

  // Wallet labels for reward names/terms (join by rewardId).
  const walletQ = useQuery({
    queryKey: ["wallet", "demo-user"],
    queryFn: () => fetchWallet("demo-user"),
  });
  const rewardsById = useMemo(
    () => Object.fromEntries((walletQ.data ?? []).map((r) => [r.id, r])),
    [walletQ.data],
  );

  // Mirror the eligibility result + winner into the journey store (v5: no onSuccess).
  useEffect(() => {
    if (eligQ.data) {
      setEligibility(eligQ.data);
      selectPlan(eligQ.data.plans[0] ?? null);
    }
  }, [eligQ.data, setEligibility, selectPlan]);

  // ── Graceful not-found ──────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex flex-col items-start gap-3 py-10">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">
          This product isn&apos;t available
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          It may have sold out or the link is stale.
        </p>
        <Link
          href="/shop"
          className="text-sm font-medium text-[var(--color-action)] hover:underline"
        >
          ← Back to search
        </Link>
      </div>
    );
  }

  const winner = eligQ.data?.plans?.[0] ?? null;
  const decision = winner?.policy.decision;
  const canCheckout = !!winner && decision !== "deny";
  const ctaLabel = decision === "ask" ? "Review & approve" : "Review checkout";

  return (
    <div className="flex flex-col gap-6 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:pb-6">
      {/* ── HERO (morph destination) ───────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <SharedElementTransition
          layoutId={sharedId.productImage(routeId)}
          className="aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)]"
        >
          {product ? (
            <ProductVisual product={product} className="h-full w-full" rounded={false} />
          ) : (
            <div className="h-full w-full animate-pulse bg-[var(--color-border)]" />
          )}
        </SharedElementTransition>

        {product && (
          <div className="flex flex-col gap-2">
            <SharedElementTransition layoutId={sharedId.productTitle(routeId)}>
              <h1 className="text-xl font-semibold leading-tight text-[var(--color-fg)]">
                {product.title}
              </h1>
            </SharedElementTransition>

            <div className="flex items-baseline gap-2">
              <SharedElementTransition layoutId={sharedId.productPrice(routeId)}>
                <span className="tnum text-2xl font-semibold text-[var(--color-fg)]">
                  {usd(selectedOffer?.priceUsd ?? product.priceUsd)}
                </span>
              </SharedElementTransition>
              {(() => {
                const price = selectedOffer?.priceUsd ?? product.priceUsd;
                const cmp = selectedOffer?.compareAtUsd ?? product.compareAtUsd;
                return cmp && cmp > price ? (
                  <span className="tnum text-base text-[var(--color-muted)] line-through">
                    {usd(cmp)}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Progressive reveal of secondary details. */}
            <AnimatedList className="flex flex-col gap-1 pt-1">
              <p key="retailer" className="text-sm text-[var(--color-muted)]">
                Sold by <span className="text-[var(--color-fg)]">{product.retailer}</span>
              </p>
              {product.availability && (
                <p key="availability" className="text-sm text-[var(--color-muted)]">
                  {product.availability}
                </p>
              )}
              {product.description && (
                <p key="description" className="pt-1 text-sm text-[var(--color-muted)]">
                  {product.description}
                </p>
              )}
              {product.source === "sandbox" && (
                <p
                  key="provenance"
                  className="mt-1 w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"
                >
                  Demo product — not live inventory
                </p>
              )}
            </AnimatedList>

            {/* Merchant offer comparison — selecting one re-evaluates rewards. */}
            {offers.length > 1 && (
              <div className="flex flex-col gap-2 pt-3">
                <h2 className="text-sm font-semibold text-[var(--color-fg)]">
                  Compare {offers.length} merchant offers
                </h2>
                {offers.map((o) => {
                  const active = o.domain === selectedOffer?.domain;
                  return (
                    <button
                      key={`${o.domain}-${o.priceUsd}`}
                      type="button"
                      onClick={() => setSelectedDomain(o.domain)}
                      aria-pressed={active}
                      className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                          : "border-[var(--color-border)] hover:border-[var(--color-brand)]"
                      }`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                          {o.domain}
                        </span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {o.condition ?? "new"} ·{" "}
                          {o.availability === "InStock" ? "In stock" : "Out of stock"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        {o.compareAtUsd && o.compareAtUsd > o.priceUsd && (
                          <span className="tnum text-xs text-[var(--color-muted)] line-through">
                            {usd(o.compareAtUsd)}
                          </span>
                        )}
                        <span className="tnum text-sm font-semibold text-[var(--color-fg)]">
                          {usd(o.priceUsd)}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <p className="text-xs text-[var(--color-muted)]">
                  Rewards below are evaluated against the selected merchant.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REWARD MAPPING + OPTIMIZATION ──────────────────────────── */}
      <div className="flex flex-col gap-5">
        {eligQ.isLoading && (
          <p className="text-sm text-[var(--color-muted)]">Checking your rewards…</p>
        )}

        {eligQ.isError && (
          <p className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {eligQ.error instanceof Error
              ? eligQ.error.message
              : "Couldn't check reward eligibility."}
          </p>
        )}

        {eligQ.data && winner && (
          <>
            <RewardMapping
              eligible={winner.useRewards}
              rejected={eligQ.data.rejected}
              rewardsById={rewardsById}
            />
            <SavingsBreakdown plan={winner} rewardsById={rewardsById} />
          </>
        )}
      </div>

      {/* ── CTA (sticky bottom on mobile) ──────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 py-3 pb-safe backdrop-blur lg:static lg:col-span-2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          {decision === "deny" ? (
            // Honest guided checkout — RePal never claims to auto-apply an
            // unsupported coupon. Buy direct at the merchant instead.
            <div className="flex w-full flex-col gap-1">
              <a
                href={product?.buyUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-sm font-medium text-[var(--color-fg)]"
              >
                Buy at merchant
              </a>
              <p className="text-xs text-[var(--color-muted)]">
                RePal can&apos;t auto-checkout this one — complete the purchase at the
                retailer.
              </p>
            </div>
          ) : (
            <MotionButton
              onClick={() => router.push("/checkout")}
              disabled={!canCheckout}
              className="w-full"
            >
              {winner ? ctaLabel : "Checking eligibility…"}
            </MotionButton>
          )}
        </div>
      </div>
    </div>
  );
}
