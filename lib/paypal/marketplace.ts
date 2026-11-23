import { paypalRequest, newRequestId } from "@/lib/paypal/client";
import { envSuffix } from "@/lib/paypal/merchants";
import type { PayPalOrder } from "@/lib/paypal/orders";

/**
 * Phase 5 — true single-checkout multi-seller (marketplace) orders.
 *
 * ONE buyer approval settles across MULTIPLE sellers: a single Orders v2 order
 * with one `purchase_unit` PER seller, each carrying its own `payee` (that
 * seller's PayPal merchant id) and a `payment_instruction.platform_fees`
 * disbursement to the platform. This is PayPal's multiparty / Commerce-Platform
 * marketplace pattern — `purchase_units[]` + `payee` + `platform_fees`.
 *
 * ⚠️ CANNOT GO LIVE WITHOUT PAYPAL MARKETPLACE PARTNER APPROVAL. Sellers must be
 * onboarded under the platform (Partner Referrals) and the platform app must hold
 * the marketplace/multiparty permissions. This module is therefore GATED OFF by
 * default (`PAYPAL_MARKETPLACE_ENABLED`). What IS complete and unit-tested here is
 * the *buildable* part the roadmap calls for: the multi-`payee` request
 * construction and the `PARTIALLY_COMPLETED` ("HTTP-207") capture parsing — the
 * one real correctness risk of a multi-seller capture. The live call waits on
 * approval. See docs/PRODUCT_SCOPE.md Phase 5 and PRD_PROGRESS.md §6/§15.
 *
 * Deterministic-money invariant holds: amounts/fees come in as caller-provided
 * USD and are only formatted to 2dp at the PayPal boundary — nothing here is
 * computed by an LLM, and this module never re-derives a price.
 *
 * OWNER: Aakash (PayPal money adapters).
 */

// ── Flag + identity resolution (env only; never sent to the client) ───────────

/**
 * Master gate. Even when `"1"`, a *live* marketplace order still needs PayPal
 * partner approval + onboarded sellers — the flag only lets the (sandbox) code
 * path run. Default OFF so prod never attempts an unapproved multiparty call.
 */
export function isMarketplaceEnabled(): boolean {
  return process.env.PAYPAL_MARKETPLACE_ENABLED === "1";
}

/**
 * The seller's PayPal **merchant id** (the `payee`) for a merchant slug, if
 * configured: `PAYPAL_PAYEE_MERCHANT_ID__<MID>`. This is the onboarded seller's
 * PayPal account id — distinct from its app client id (Phase 2 routing).
 */
export function payeeMerchantIdFor(merchantId: string): string | undefined {
  const s = envSuffix(merchantId);
  if (!s) return undefined;
  return process.env[`PAYPAL_PAYEE_MERCHANT_ID__${s}`] || undefined;
}

/** The platform's own PayPal merchant id that receives `platform_fees`. */
export function platformPayeeMerchantId(): string | undefined {
  return process.env.PAYPAL_PLATFORM_MERCHANT_ID || undefined;
}

/** Partner attribution (BN) code, required on multiparty calls by PayPal. */
function partnerAttributionId(): string | undefined {
  return process.env.PAYPAL_PARTNER_ATTRIBUTION_ID || undefined;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketplaceUnit {
  /** Merchant slug (maps to a seller). */
  merchantId: string;
  /**
   * The seller's PayPal payee merchant id. If omitted, resolved from env via
   * `payeeMerchantIdFor`. A real marketplace order needs one per seller.
   */
  payeeMerchantId?: string;
  /** This seller's line total, in USD. */
  amountUsd: number;
  description?: string;
  /** RePal's platform fee on this unit, in USD (optional). */
  platformFeeUsd?: number;
  /** Stable reference for this unit (defaults to `<merchantId>-<n>`). */
  referenceId?: string;
}

export interface MarketplaceOrderInput {
  units: MarketplaceUnit[];
  /** Buyer-present approval return/cancel URLs (built server-side). */
  returnUrl?: string;
  cancelUrl?: string;
  /** Pay sellers immediately (default) or hold for delayed disbursement. */
  disbursementMode?: "INSTANT" | "DELAYED";
}

/** Thrown by the live create/capture calls while Phase 5 is gated off. */
export class MarketplaceDisabledError extends Error {
  readonly code = "marketplace_disabled";
  constructor() {
    super(
      "Single-checkout multi-seller marketplace is not enabled. It requires PayPal " +
        "marketplace partner approval (Phase 5). The live path is per-merchant routing " +
        "(Phase 2): one separate single-seller order + capture per merchant.",
    );
    this.name = "MarketplaceDisabledError";
  }
}

// ── Request construction (PURE — the core, fully testable) ─────────────────────

/**
 * Build the Orders v2 body for a multi-seller order: one `purchase_unit` per
 * seller, each with its own `payee` and (when a fee is set) a
 * `payment_instruction.platform_fees` disbursement to the platform. Pure — does
 * not touch the network. Throws on an empty cart.
 */
export function buildMarketplaceOrderBody(input: MarketplaceOrderInput): Record<string, unknown> {
  if (!input.units.length) throw new Error("marketplace order needs at least one unit");

  const platformPayee = platformPayeeMerchantId();

  const purchase_units = input.units.map((u, i) => {
    const referenceId = u.referenceId ?? `${u.merchantId}-${i + 1}`;
    const payeeMerchantId = u.payeeMerchantId ?? payeeMerchantIdFor(u.merchantId);

    const unit: Record<string, unknown> = {
      reference_id: referenceId,
      amount: { currency_code: "USD", value: u.amountUsd.toFixed(2) },
    };
    if (u.description) unit.description = u.description;
    // The per-seller payee is what makes this a multiparty order.
    if (payeeMerchantId) unit.payee = { merchant_id: payeeMerchantId };

    // Platform fee → split disbursement. Only attached when a positive fee is set.
    if (u.platformFeeUsd && u.platformFeeUsd > 0) {
      const platform_fee: Record<string, unknown> = {
        amount: { currency_code: "USD", value: u.platformFeeUsd.toFixed(2) },
      };
      if (platformPayee) platform_fee.payee = { merchant_id: platformPayee };
      unit.payment_instruction = {
        disbursement_mode: input.disbursementMode ?? "INSTANT",
        platform_fees: [platform_fee],
      };
    }
    return unit;
  });

  const body: Record<string, unknown> = { intent: "CAPTURE", purchase_units };

  // Buyer-present approval context (single approval covers every unit).
  if (input.returnUrl && input.cancelUrl) {
    body.payment_source = {
      paypal: {
        experience_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
        },
      },
    };
  }

  return body;
}

// ── Capture parsing (PURE — the "HTTP-207" / PARTIALLY_COMPLETED handling) ─────

export interface UnitCapture {
  referenceId?: string;
  payeeMerchantId?: string;
  captureId?: string;
  /** PayPal capture status: COMPLETED | PENDING | DECLINED | FAILED | … */
  status?: string;
  amountUsd?: number;
}

export interface CaptureSummary {
  /** The order-level status PayPal returned (COMPLETED | PARTIALLY_COMPLETED | …). */
  orderStatus: string;
  /** True when some — but not all — sellers captured (the 207 case). */
  partiallyCompleted: boolean;
  units: UnitCapture[];
  completedCount: number;
  /** Units with a terminal non-COMPLETED, non-PENDING status (declined/failed). */
  failedCount: number;
}

/**
 * Parse a multi-`purchase_unit` capture response into a per-seller summary and a
 * single `partiallyCompleted` verdict. This is the one correctness-critical piece
 * a multi-seller capture adds over single-seller: a capture can succeed for some
 * sellers and fail for others (HTTP 207 / `status: "PARTIALLY_COMPLETED"`), and
 * the caller must know exactly which legs settled. Pure + defensive against
 * missing fields.
 */
export function summarizeCapture(order: unknown): CaptureSummary {
  const o = order as {
    status?: string;
    purchase_units?: {
      reference_id?: string;
      payee?: { merchant_id?: string };
      payments?: {
        captures?: { id?: string; status?: string; amount?: { value?: string } }[];
      };
    }[];
  };

  const pus = o?.purchase_units ?? [];
  const units: UnitCapture[] = pus.map((pu) => {
    const cap = pu.payments?.captures?.[0];
    const value = cap?.amount?.value;
    return {
      referenceId: pu.reference_id,
      payeeMerchantId: pu.payee?.merchant_id,
      captureId: cap?.id,
      status: cap?.status,
      amountUsd: value != null && value !== "" ? Number(value) : undefined,
    };
  });

  const completedCount = units.filter((u) => u.status === "COMPLETED").length;
  const failedCount = units.filter(
    (u) => u.status != null && u.status !== "COMPLETED" && u.status !== "PENDING",
  ).length;

  // Trust PayPal's order status when present; otherwise infer from the per-unit
  // captures (all done → COMPLETED, some done → PARTIALLY_COMPLETED).
  const orderStatus =
    o?.status ??
    (units.length > 0 && completedCount === units.length
      ? "COMPLETED"
      : completedCount > 0
        ? "PARTIALLY_COMPLETED"
        : "PENDING");

  const partiallyCompleted =
    orderStatus === "PARTIALLY_COMPLETED" ||
    (units.length > 1 && completedCount > 0 && completedCount < units.length);

  return { orderStatus, partiallyCompleted, units, completedCount, failedCount };
}

// ── Live calls (GATED — throw MarketplaceDisabledError until approved) ─────────

/**
 * Create a multi-seller order (platform app orchestrates; partner-attribution
 * header set). Throws `MarketplaceDisabledError` unless `PAYPAL_MARKETPLACE_ENABLED`
 * is on — the gate that keeps an unapproved multiparty call from ever firing.
 */
export async function createMarketplaceOrder(input: MarketplaceOrderInput): Promise<PayPalOrder> {
  if (!isMarketplaceEnabled()) throw new MarketplaceDisabledError();

  const headers: Record<string, string> = {};
  const bn = partnerAttributionId();
  if (bn) headers["PayPal-Partner-Attribution-Id"] = bn;

  // No `creds` → the platform seller orchestrates the multiparty order.
  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: buildMarketplaceOrderBody(input),
    requestId: newRequestId(),
    headers,
  });
}

/**
 * Capture a multi-seller order and summarize each seller's leg, surfacing a
 * `PARTIALLY_COMPLETED` result honestly. Gated like `createMarketplaceOrder`.
 */
export async function captureMarketplaceOrder(
  orderId: string,
): Promise<{ raw: PayPalOrder; summary: CaptureSummary }> {
  if (!isMarketplaceEnabled()) throw new MarketplaceDisabledError();

  const raw = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    requestId: newRequestId(),
  });
  return { raw, summary: summarizeCapture(raw) };
}
