/**
 * RePal motion tokens — the SINGLE source of truth for animation timing and
 * easing across the app. Never hard-code a duration or cubic-bezier in a
 * component; import from here so the whole app shares one motion language.
 *
 * Durations are in SECONDS (Motion for React's unit). The millisecond spec:
 *   instant 100 · micro 140 · quick 200 · standard 280 · navigation 340 ·
 *   shared-element 380 · complex 450
 *
 * See docs/TECH_PRD.md and the RePal Motion System brief.
 */

/** Named durations (seconds). */
export const duration = {
  instant: 0.1,
  micro: 0.14,
  quick: 0.2,
  standard: 0.28,
  navigation: 0.34,
  sharedElement: 0.38,
  complex: 0.45,
} as const;

/** Named cubic-bezier easings (Motion accepts the 4-tuple form). */
export const easing = {
  /** Decelerate — things entering the screen. */
  enter: [0.16, 1, 0.3, 1] as const,
  /** Standard in-out — most transitions. */
  standard: [0.22, 1, 0.36, 1] as const,
  /** Accelerate — things leaving the screen. */
  exit: [0.4, 0, 1, 1] as const,
};

/**
 * Well-damped spring for shared-element / layout transitions — no visible
 * bounce, settles crisply. Tuned for `layout` and `layoutId` morphs.
 */
export const sharedSpring = {
  type: "spring",
  stiffness: 420,
  damping: 40,
  mass: 1,
} as const;

/** Common tweened transitions, ready to spread into a `transition` prop. */
export const transitions = {
  instant: { duration: duration.instant, ease: easing.standard },
  micro: { duration: duration.micro, ease: easing.standard },
  quick: { duration: duration.quick, ease: easing.standard },
  standard: { duration: duration.standard, ease: easing.standard },
  enter: { duration: duration.navigation, ease: easing.enter },
  exit: { duration: duration.quick, ease: easing.exit },
  navigation: { duration: duration.navigation, ease: easing.standard },
  complex: { duration: duration.complex, ease: easing.standard },
} as const;

/** Reusable enter/exit variants for pages and lists. */
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

/** Per-child stagger timing for AnimatedList / streamed results. */
export const stagger = {
  fast: 0.03,
  normal: 0.05,
  slow: 0.08,
} as const;

// ─── Shared-element identity helpers ──────────────────────────────────
// Stable layoutId strings so a product morphs coherently across routes.
// Every surface that renders the same product MUST use these exact ids.

export const sharedId = {
  productCard: (id: string) => `product-card-${id}`,
  productImage: (id: string) => `product-image-${id}`,
  productTitle: (id: string) => `product-title-${id}`,
  productPrice: (id: string) => `product-price-${id}`,
} as const;
