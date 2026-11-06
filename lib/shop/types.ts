import type { Offer } from "@/lib/types";
import type { PlanWithPolicy, PlanPurchaseResult } from "@/lib/pipeline";

/**
 * Shopping-journey view types. These sit ON TOP of the deterministic backend
 * contracts (lib/types `Offer`, lib/pipeline `PlanWithPolicy`) — they add only
 * presentation fields (a visual, availability text, a provenance flag). The
 * money fields still come straight from the optimizer; nothing here recomputes.
 */

/** Where a product came from — surfaced in the UI so demo data is never passed off as live. */
export type ProductSource = "channel3" | "sandbox";

/**
 * One merchant's offer for a product — the unit of offer comparison. Maps from
 * Channel3's `ProductOffer` (domain, price, availability, condition, buy URL).
 * `priceUsd` is the current price; `compareAtUsd` the pre-discount price (for a
 * strike-through). `buyUrl` is an affiliate-tracked link — fetch fresh, never
 * cache long. Multiple offers per product differ by merchant AND condition
 * (e.g. tiffany.com `new` $395 vs therealreal.com `used` $225).
 */
export interface MerchantOffer {
  /** Retailer domain, e.g. "bestbuy.com". */
  domain: string;
  priceUsd: number;
  compareAtUsd?: number;
  currency: string;
  /** "InStock" | "OutOfStock" (Channel3's two public availability values). */
  availability: string;
  /** "new" | "used" | null (unknown). */
  condition?: "new" | "used" | null;
  /** Affiliate-tracked buy URL. */
  buyUrl: string;
  /** Max affiliate commission rate (decimal fraction), for ranking earning potential. */
  maxCommissionRate?: number;
}

/**
 * A shoppable product. Extends the normalized `Offer` with the presentation
 * fields the journey UI needs. The base `Offer` fields (priceUsd, retailer,
 * buyUrl) always reflect the BEST (cheapest in-locale) offer so the optimizer
 * and existing screens keep working with a single canonical price; `offers[]`
 * carries the full merchant comparison. `imageUrl` is a real product photo when
 * the source provides one; otherwise the UI renders a deterministic generated
 * visual keyed on `id` (offline-safe, CSP-safe, stable for shared-element morphs).
 */
export interface Product extends Offer {
  category: string;
  description?: string;
  availability?: string;
  imageUrl?: string;
  brand?: string;
  currency?: string;
  /** Pre-discount price of the best offer (for strike-through). */
  compareAtUsd?: number;
  /** All merchant offers for this product, cheapest first. Present for live (channel3) products. */
  offers?: MerchantOffer[];
  /** Provenance — "sandbox" must be shown as demo data, never as a live offer. */
  source: ProductSource;
}

/** Response of GET /api/products?q=&max= */
export interface ProductSearchResponse {
  q: string;
  /** "channel3" when live, "sandbox" when the labelled demo catalog served it. */
  source: ProductSource;
  products: Product[];
  /** Number of products returned (convenience for the UI). */
  count?: number;
}

/** The eligibility + optimization result for a selected product (from /api/plan). */
export type EligibilityResult = PlanPurchaseResult;
export type { PlanWithPolicy };

/**
 * The payment state machine — each value maps to a real backend milestone, never
 * a frontend timer. `demo_complete` is a server-signed receipt issued WITHOUT a
 * live PayPal capture (shown clearly as sandbox), distinct from a live `complete`.
 */
export type PaymentStatus =
  | "idle"
  | "review"
  | "preparing" // POST /api/pay/order
  | "awaiting_approval" // PayPal JS SDK buyer approval
  | "capturing" // POST /api/pay/capture
  | "verifying" // receipt signing
  | "complete" // live capture verified + receipt signed
  | "demo_complete" // sandbox: receipt signed, no live PayPal capture
  | "pending"
  | "cancelled"
  | "failed";

/** True once payment has reached a server-verified terminal success. */
export function isPaymentSuccess(s: PaymentStatus): boolean {
  return s === "complete" || s === "demo_complete";
}
