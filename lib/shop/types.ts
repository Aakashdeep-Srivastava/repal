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
 * A shoppable product. Extends the normalized `Offer` with the presentation
 * fields the journey UI needs. `imageUrl` is used when a real source provides
 * one; otherwise the UI renders a deterministic generated visual keyed on `id`
 * (offline-safe, CSP-safe, stable for shared-element morphs).
 */
export interface Product extends Offer {
  category: string;
  description?: string;
  availability?: string;
  imageUrl?: string;
  /** Provenance — "sandbox" must be shown as demo data, never as a live offer. */
  source: ProductSource;
}

/** Response of GET /api/products?q=&max= */
export interface ProductSearchResponse {
  q: string;
  /** "channel3" when live, "sandbox" when the labelled demo catalog served it. */
  source: ProductSource;
  products: Product[];
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
