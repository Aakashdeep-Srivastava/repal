"use client";

import type { CSSProperties } from "react";
import type { Product } from "@/lib/shop/types";

/**
 * ProductVisual — the visual for a product card or detail hero.
 *
 * If the product carries a real `imageUrl` we render it. Otherwise we render a
 * DETERMINISTIC, offline/CSP-safe generated visual: a CSS gradient derived from
 * the product `id` (hashed → two brand-palette hues) with the category initial
 * centered on top. No external network fetch on the fallback path, so it works
 * under a strict CSP and renders identically every time (stable for
 * shared-element morphs — the caller applies `layoutId`).
 *
 * The root element is style-driven and accepts `className`, so the caller can
 * size it for a small card or a large hero without this component caring.
 */

export interface ProductVisualProps {
  product: Product;
  className?: string;
  /** Apply rounded corners (default true). Set false when the caller clips. */
  rounded?: boolean;
}

/** Cheap, stable string hash (FNV-1a 32-bit) → unsigned int. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Brand-leaning gradient derived from the id. Two hues a fixed distance apart on
 * the wheel, biased toward RePal's indigo/violet/teal band for cohesion.
 */
function gradientFor(id: string): { from: string; to: string; ink: string } {
  const h = hashId(id);
  // Base hue kept in a blue band (cyan → blue → indigo), no violet.
  const base = 205 + (h % 40);
  const from = `hsl(${base} 74% 56%)`;
  const to = `hsl(${base + 22} 70% 42%)`;
  // Readable ink over a mid-saturation gradient.
  const ink = "hsl(0 0% 100% / 0.92)";
  return { from, to, ink };
}

/** First meaningful glyph for the category badge. */
function categoryInitial(category: string): string {
  const c = category.trim();
  return c ? c[0]!.toUpperCase() : "#";
}

export function ProductVisual({ product, className, rounded = true }: ProductVisualProps) {
  const radius = rounded ? "1rem" : "0";

  if (product.imageUrl) {
    return (
      // Using a plain <img> keeps this independent of next/image remote-pattern
      // config and CSP image sources the caller may not have whitelisted.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt={product.title}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: radius,
          display: "block",
        }}
      />
    );
  }

  const { from, to, ink } = gradientFor(product.id);
  const initial = categoryInitial(product.category);

  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius,
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  };

  return (
    <div className={className} style={rootStyle} aria-label={product.title} role="img">
      {/* Soft highlight to give the flat gradient some depth at hero size. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 90% at 25% 15%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%)",
        }}
      />
      {/* Category initial — scales with the container via cqmin when available,
          falling back to a sensible em size. */}
      <span
        aria-hidden
        style={{
          position: "relative",
          color: ink,
          fontWeight: 700,
          fontSize: "clamp(1.5rem, 42cqmin, 7rem)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
      >
        {initial}
      </span>
    </div>
  );
}

export default ProductVisual;
