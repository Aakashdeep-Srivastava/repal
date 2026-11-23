import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isMarketplaceEnabled,
  payeeMerchantIdFor,
  buildMarketplaceOrderBody,
  summarizeCapture,
  createMarketplaceOrder,
  captureMarketplaceOrder,
  MarketplaceDisabledError,
} from "./marketplace";

// Save/restore every PAYPAL_* env key so tests don't leak into each other or prod
// config (same discipline as merchants.test.ts).
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) saved[k] = process.env[k];
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) delete process.env[k];
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) delete process.env[k];
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
});

describe("isMarketplaceEnabled", () => {
  it("is off by default and only on for exactly '1'", () => {
    expect(isMarketplaceEnabled()).toBe(false);
    process.env.PAYPAL_MARKETPLACE_ENABLED = "true";
    expect(isMarketplaceEnabled()).toBe(false);
    process.env.PAYPAL_MARKETPLACE_ENABLED = "1";
    expect(isMarketplaceEnabled()).toBe(true);
  });
});

describe("payeeMerchantIdFor", () => {
  it("reads PAYPAL_PAYEE_MERCHANT_ID__<MID> by env-safe suffix", () => {
    process.env.PAYPAL_PAYEE_MERCHANT_ID__CLEARTRIP = "MERCH123";
    expect(payeeMerchantIdFor("cleartrip")).toBe("MERCH123");
    expect(payeeMerchantIdFor("acme corp.")).toBeUndefined();
  });
});

describe("buildMarketplaceOrderBody", () => {
  it("throws on an empty cart", () => {
    expect(() => buildMarketplaceOrderBody({ units: [] })).toThrow(/at least one unit/);
  });

  it("builds one purchase_unit per seller with 2dp amounts and a reference_id", () => {
    const body = buildMarketplaceOrderBody({
      units: [
        { merchantId: "cleartrip", amountUsd: 12.3 },
        { merchantId: "fwrd", amountUsd: 200, description: "Fern Top" },
      ],
    }) as { intent: string; purchase_units: Record<string, unknown>[] };

    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units).toHaveLength(2);
    expect(body.purchase_units[0]).toMatchObject({
      reference_id: "cleartrip-1",
      amount: { currency_code: "USD", value: "12.30" },
    });
    expect(body.purchase_units[1]).toMatchObject({
      reference_id: "fwrd-2",
      amount: { currency_code: "USD", value: "200.00" },
      description: "Fern Top",
    });
  });

  it("attaches a per-seller payee from env and a platform_fees disbursement", () => {
    process.env.PAYPAL_PAYEE_MERCHANT_ID__CLEARTRIP = "SELLER_CT";
    process.env.PAYPAL_PLATFORM_MERCHANT_ID = "PLATFORM_X";

    const body = buildMarketplaceOrderBody({
      units: [{ merchantId: "cleartrip", amountUsd: 100, platformFeeUsd: 7.5 }],
      disbursementMode: "DELAYED",
    }) as { purchase_units: Record<string, unknown>[] };

    const pu = body.purchase_units[0];
    expect(pu.payee).toEqual({ merchant_id: "SELLER_CT" });
    expect(pu.payment_instruction).toEqual({
      disbursement_mode: "DELAYED",
      platform_fees: [{ amount: { currency_code: "USD", value: "7.50" }, payee: { merchant_id: "PLATFORM_X" } }],
    });
  });

  it("omits payee/fees when unmapped and omits fee when zero", () => {
    const body = buildMarketplaceOrderBody({
      units: [{ merchantId: "unknown", amountUsd: 50, platformFeeUsd: 0 }],
    }) as { purchase_units: Record<string, unknown>[] };
    const pu = body.purchase_units[0];
    expect(pu.payee).toBeUndefined();
    expect(pu.payment_instruction).toBeUndefined();
  });

  it("prefers an explicit payeeMerchantId over the env lookup", () => {
    process.env.PAYPAL_PAYEE_MERCHANT_ID__CLEARTRIP = "FROM_ENV";
    const body = buildMarketplaceOrderBody({
      units: [{ merchantId: "cleartrip", payeeMerchantId: "EXPLICIT", amountUsd: 10 }],
    }) as { purchase_units: Record<string, unknown>[] };
    expect(body.purchase_units[0].payee).toEqual({ merchant_id: "EXPLICIT" });
  });

  it("adds a single buyer-approval experience_context when return/cancel URLs are given", () => {
    const body = buildMarketplaceOrderBody({
      units: [{ merchantId: "a", amountUsd: 1 }],
      returnUrl: "https://repal.shop/checkout?paypal=return",
      cancelUrl: "https://repal.shop/checkout?paypal=cancel",
    }) as { payment_source?: { paypal?: { experience_context?: Record<string, string> } } };
    expect(body.payment_source?.paypal?.experience_context).toMatchObject({
      return_url: "https://repal.shop/checkout?paypal=return",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
    });
  });
});

describe("summarizeCapture (HTTP-207 / PARTIALLY_COMPLETED handling)", () => {
  const twoUnits = (s1: string, s2: string) => ({
    status: s1 === "COMPLETED" && s2 === "COMPLETED" ? "COMPLETED" : "PARTIALLY_COMPLETED",
    purchase_units: [
      { reference_id: "a-1", payee: { merchant_id: "SA" }, payments: { captures: [{ id: "CAP_A", status: s1, amount: { value: "100.00" } }] } },
      { reference_id: "b-2", payee: { merchant_id: "SB" }, payments: { captures: [{ id: "CAP_B", status: s2, amount: { value: "50.00" } }] } },
    ],
  });

  it("reports all legs completed", () => {
    const sum = summarizeCapture(twoUnits("COMPLETED", "COMPLETED"));
    expect(sum.orderStatus).toBe("COMPLETED");
    expect(sum.partiallyCompleted).toBe(false);
    expect(sum.completedCount).toBe(2);
    expect(sum.failedCount).toBe(0);
    expect(sum.units.map((u) => u.captureId)).toEqual(["CAP_A", "CAP_B"]);
    expect(sum.units[0].amountUsd).toBe(100);
  });

  it("flags a partial capture when one seller fails", () => {
    const sum = summarizeCapture(twoUnits("COMPLETED", "DECLINED"));
    expect(sum.orderStatus).toBe("PARTIALLY_COMPLETED");
    expect(sum.partiallyCompleted).toBe(true);
    expect(sum.completedCount).toBe(1);
    expect(sum.failedCount).toBe(1);
  });

  it("infers PARTIALLY_COMPLETED from per-unit captures when order status is absent", () => {
    const sum = summarizeCapture({
      purchase_units: [
        { reference_id: "a-1", payments: { captures: [{ id: "X", status: "COMPLETED" }] } },
        { reference_id: "b-2", payments: { captures: [{ id: "Y", status: "PENDING" }] } },
      ],
    });
    expect(sum.orderStatus).toBe("PARTIALLY_COMPLETED");
    expect(sum.partiallyCompleted).toBe(true);
    expect(sum.failedCount).toBe(0); // PENDING is not a failure
  });

  it("is defensive against missing purchase_units", () => {
    const sum = summarizeCapture({});
    expect(sum.units).toEqual([]);
    expect(sum.completedCount).toBe(0);
    expect(sum.partiallyCompleted).toBe(false);
  });
});

describe("gate — live calls refuse while disabled (no network)", () => {
  it("createMarketplaceOrder throws MarketplaceDisabledError when off", async () => {
    await expect(createMarketplaceOrder({ units: [{ merchantId: "a", amountUsd: 1 }] })).rejects.toBeInstanceOf(
      MarketplaceDisabledError,
    );
  });

  it("captureMarketplaceOrder throws MarketplaceDisabledError when off", async () => {
    await expect(captureMarketplaceOrder("ORDER123")).rejects.toBeInstanceOf(MarketplaceDisabledError);
  });
});
