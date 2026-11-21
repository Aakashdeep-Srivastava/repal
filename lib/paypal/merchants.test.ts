import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveSeller,
  hasDedicatedSeller,
  listConfiguredSellers,
  envSuffix,
  defaultMerchantId,
} from "./merchants";

const PP_KEYS = Object.keys(process.env).filter((k) => k.startsWith("PAYPAL_"));
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of PP_KEYS) saved[k] = process.env[k];
  // Also clear any dynamically-added dedicated keys between tests.
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) delete process.env[k];
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) delete process.env[k];
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
});

describe("envSuffix", () => {
  it("upper-cases and replaces non-alphanumerics with underscores", () => {
    expect(envSuffix("texo-vera")).toBe("TEXO_VERA");
    expect(envSuffix("acme corp.")).toBe("ACME_CORP");
    expect(envSuffix("gta6")).toBe("GTA6");
  });
});

describe("resolveSeller", () => {
  it("uses the platform seller when no merchantId is given", () => {
    process.env.PAYPAL_CLIENT_ID = "plat-id";
    process.env.PAYPAL_CLIENT_SECRET = "plat-secret";
    process.env.PAYPAL_WEBHOOK_ID = "wh-plat";
    const s = resolveSeller();
    expect(s).toMatchObject({
      merchantId: defaultMerchantId(),
      dedicated: false,
      webhookId: "wh-plat",
      credentials: { clientId: "plat-id", clientSecret: "plat-secret" },
    });
  });

  it("falls back to the platform seller for a merchant with no dedicated app", () => {
    process.env.PAYPAL_CLIENT_ID = "plat-id";
    process.env.PAYPAL_CLIENT_SECRET = "plat-secret";
    const s = resolveSeller("texovera");
    expect(s.dedicated).toBe(false);
    expect(s.credentials.clientId).toBe("plat-id");
  });

  it("routes to a dedicated seller when one is configured", () => {
    process.env.PAYPAL_CLIENT_ID = "plat-id";
    process.env.PAYPAL_CLIENT_SECRET = "plat-secret";
    process.env.PAYPAL_CLIENT_ID__TEXOVERA = "texo-id";
    process.env.PAYPAL_CLIENT_SECRET__TEXOVERA = "texo-secret";
    process.env.PAYPAL_WEBHOOK_ID__TEXOVERA = "wh-texo";
    const s = resolveSeller("texovera");
    expect(s).toMatchObject({
      merchantId: "texovera",
      dedicated: true,
      webhookId: "wh-texo",
      credentials: { clientId: "texo-id", clientSecret: "texo-secret" },
    });
  });

  it("throws only when NO seller is configured at all", () => {
    expect(() => resolveSeller("texovera")).toThrow(/No PayPal seller configured/);
  });
});

describe("hasDedicatedSeller + listConfiguredSellers", () => {
  it("detects a dedicated seller and lists all without leaking secrets", () => {
    process.env.PAYPAL_CLIENT_ID = "plat-id";
    process.env.PAYPAL_CLIENT_SECRET = "plat-secret";
    process.env.PAYPAL_CLIENT_ID__GTA6 = "gta-id";
    process.env.PAYPAL_CLIENT_SECRET__GTA6 = "gta-secret";

    expect(hasDedicatedSeller("gta6")).toBe(true);
    expect(hasDedicatedSeller("unknown")).toBe(false);

    const list = listConfiguredSellers();
    expect(list.some((s) => s.merchantId === defaultMerchantId() && !s.dedicated)).toBe(true);
    expect(list.some((s) => s.merchantId === "GTA6" && s.dedicated)).toBe(true);
    // No secret material in the diagnostic output.
    expect(JSON.stringify(list)).not.toMatch(/secret/i);
  });
});
