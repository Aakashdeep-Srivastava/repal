import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Product,
  EligibilityResult,
  PlanWithPolicy,
  PaymentStatus,
} from "@/lib/shop/types";

/**
 * Purchase-journey store — the one piece of client state that spans routes:
 * search query → selected product → eligibility/optimization → chosen plan →
 * checkout → payment status → receipt.
 *
 * Persisted to sessionStorage so a refresh mid-journey (e.g. during checkout)
 * restores progress — the brief requires "preserve user progress after refresh".
 * The large `products` result list is intentionally NOT persisted (it's cheap to
 * refetch and would bloat storage); the SELECTED product is, so detail/checkout
 * survive a reload.
 *
 * Money never originates here — `eligibility` and `plan` hold values produced by
 * the deterministic backend (/api/plan); this store only carries them between
 * screens.
 */

export interface JourneyState {
  // Search
  query: string;
  maxPriceUsd?: number;
  products: Product[]; // transient (not persisted)
  productsLoading: boolean;

  // Selection + optimization
  selectedProduct: Product | null;
  eligibility: EligibilityResult | null; // from /api/plan for the selection
  selectedPlan: PlanWithPolicy | null;

  // Checkout / payment
  payment: PaymentStatus;
  paymentError?: string;
  /** Stable per-attempt key → idempotent order/capture (no double charge). */
  checkoutKey?: string;
  orderId?: string;
  receiptId?: string;

  // ─── Actions ───
  setQuery: (query: string, maxPriceUsd?: number) => void;
  setProducts: (products: Product[]) => void;
  setProductsLoading: (loading: boolean) => void;
  selectProduct: (product: Product) => void;
  setEligibility: (result: EligibilityResult | null) => void;
  selectPlan: (plan: PlanWithPolicy | null) => void;
  beginCheckout: () => void;
  setPayment: (status: PaymentStatus, error?: string) => void;
  setOrderId: (orderId: string) => void;
  setReceiptId: (receiptId: string) => void;
  /** Reset the whole journey (e.g. "back to dashboard" after a receipt). */
  reset: () => void;
}

/** Deterministic-ish unique key without Math.random (SSR/replay-safe enough). */
function newCheckoutKey(): string {
  return `co_${Date.now().toString(36)}_${(globalThis.crypto?.randomUUID?.() ?? String(performance.now())).slice(0, 8)}`;
}

const initial = {
  query: "",
  maxPriceUsd: undefined as number | undefined,
  products: [] as Product[],
  productsLoading: false,
  selectedProduct: null as Product | null,
  eligibility: null as EligibilityResult | null,
  selectedPlan: null as PlanWithPolicy | null,
  payment: "idle" as PaymentStatus,
  paymentError: undefined as string | undefined,
  checkoutKey: undefined as string | undefined,
  orderId: undefined as string | undefined,
  receiptId: undefined as string | undefined,
};

export const useJourney = create<JourneyState>()(
  persist(
    (set) => ({
      ...initial,

      setQuery: (query, maxPriceUsd) => set({ query, maxPriceUsd }),
      setProducts: (products) => set({ products, productsLoading: false }),
      setProductsLoading: (productsLoading) => set({ productsLoading }),

      selectProduct: (product) =>
        set({
          selectedProduct: product,
          // a new selection invalidates any prior optimization/plan/checkout
          eligibility: null,
          selectedPlan: null,
          payment: "idle",
          paymentError: undefined,
          checkoutKey: undefined,
          orderId: undefined,
          receiptId: undefined,
        }),

      setEligibility: (eligibility) => set({ eligibility }),
      selectPlan: (selectedPlan) => set({ selectedPlan }),

      beginCheckout: () =>
        set({ payment: "review", paymentError: undefined, checkoutKey: newCheckoutKey() }),
      setPayment: (payment, paymentError) => set({ payment, paymentError }),
      setOrderId: (orderId) => set({ orderId }),
      setReceiptId: (receiptId) => set({ receiptId }),

      reset: () => set({ ...initial }),
    }),
    {
      name: "repal-journey",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.sessionStorage : (undefined as never),
      ),
      // Persist only what makes a refresh resumable — not the transient list.
      partialize: (s) => ({
        query: s.query,
        maxPriceUsd: s.maxPriceUsd,
        selectedProduct: s.selectedProduct,
        eligibility: s.eligibility,
        selectedPlan: s.selectedPlan,
        payment: s.payment,
        checkoutKey: s.checkoutKey,
        orderId: s.orderId,
        receiptId: s.receiptId,
      }),
      skipHydration: false,
    },
  ),
);
