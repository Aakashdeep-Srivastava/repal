"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatedList } from "@/components/motion";
import { ProductCard } from "@/components/shop/ProductCard";
import { useJourney } from "@/lib/store/journey";
import type { Product, ProductSearchResponse } from "@/lib/shop/types";

/**
 * /shop — product RESULTS. Reads `?q` and `?max` from the URL, fetches the real
 * (or labelled-sandbox) catalog via /api/products, and streams the results into
 * a responsive grid of ProductCard shared-element sources. Skeletons are tied to
 * the real `isLoading` state (not a timer). Selecting a card records it in the
 * journey store and routes to the detail page, where it morphs into the hero.
 *
 * Content only — the persistent shell/header/search live in app/(shop)/layout.
 */

async function fetchProducts(q: string, max: string | null): Promise<ProductSearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (max) params.set("max", max);
  const qs = params.toString();
  const res = await fetch(`/api/products${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Product search failed (${res.status})`);
  return res.json();
}

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="aspect-[4/3] w-full animate-pulse bg-[var(--color-border)]" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="mt-1 h-4 w-1/3 animate-pulse rounded bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

function ShopResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const max = searchParams.get("max");

  const setProducts = useJourney((s) => s.setProducts);
  const selectProduct = useJourney((s) => s.selectProduct);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["products", q, max ?? ""],
    queryFn: () => fetchProducts(q, max),
  });

  // Mirror the fetched list into the journey store (v5 has no onSuccess).
  useEffect(() => {
    if (data?.products) setProducts(data.products);
  }, [data, setProducts]);

  function onSelect(product: Product) {
    selectProduct(product);
    router.push(`/product/${product.id}`);
  }

  const isSandbox = data?.source === "sandbox";
  const products = data?.products ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-fg)]">
            {q ? `Results for "${q}"` : "Browse products"}
          </h1>
          {!q && (
            <p className="text-sm text-[var(--color-muted)]">
              Showing the full catalog — search above to narrow it down.
            </p>
          )}
        </div>
        {!isLoading && products.length > 0 && (
          <span className="text-xs text-[var(--color-muted)]">
            {products.length} item{products.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Provenance — never pass demo data off as live inventory. */}
      {isSandbox && (
        <p className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500">
          Demo products — not live inventory.
        </p>
      )}

      {isError && (
        <p className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error instanceof Error ? error.message : "Couldn't load products."}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : products.length === 0 && !isError ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-6 text-sm text-[var(--color-muted)]">
          No products matched {q ? `"${q}"` : "your search"}. Try a different term.
        </p>
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onSelect={onSelect} />
          ))}
        </AnimatedList>
      )}
    </div>
  );
}

export default function ShopPage() {
  // useSearchParams requires a Suspense boundary for static generation.
  return (
    <Suspense fallback={null}>
      <ShopResults />
    </Suspense>
  );
}
