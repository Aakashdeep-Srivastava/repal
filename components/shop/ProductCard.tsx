"use client";

import { SharedElementTransition, MotionCard } from "@/components/motion";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { sharedId } from "@/lib/motion/tokens";
import type { Product } from "@/lib/shop/types";

/**
 * ProductCard — one result in the /shop grid and the SOURCE end of the
 * product shared-element morph.
 *
 * The visual, title, and price are each wrapped in SharedElementTransition with
 * the matching `sharedId.*` so that, when the user taps through to the detail
 * hero (which uses the SAME ids), Motion morphs the image/title/price from their
 * card position/size to the hero's. Tapping anywhere on the card selects it.
 *
 * Money is display-only (the price string straight off `product.priceUsd`); this
 * component never computes anything.
 */
export interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <MotionCard
      onClick={() => onSelect(product)}
      aria-label={`${product.title} — ${usd(product.priceUsd)} at ${product.retailer}`}
      className="flex flex-col overflow-hidden p-0"
    >
      {/* Visual — morph source (image id matches the detail hero). */}
      <SharedElementTransition
        layoutId={sharedId.productImage(product.id)}
        className="aspect-[4/3] w-full"
      >
        <ProductVisual product={product} className="h-full w-full" rounded={false} />
      </SharedElementTransition>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        {/* Title — clamped to 2 lines so long names never blow out the card. */}
        <SharedElementTransition layoutId={sharedId.productTitle(product.id)}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-fg)]">
            {product.title}
          </h3>
        </SharedElementTransition>

        <p className="truncate text-xs text-[var(--color-muted)]">{product.retailer}</p>

        <SharedElementTransition
          layoutId={sharedId.productPrice(product.id)}
          className="mt-1"
        >
          <span className="tnum text-base font-semibold text-[var(--color-fg)]">
            {usd(product.priceUsd)}
          </span>
        </SharedElementTransition>
      </div>
    </MotionCard>
  );
}

export default ProductCard;
