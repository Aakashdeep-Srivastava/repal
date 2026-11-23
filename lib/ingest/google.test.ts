import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanQuery, scanWindow, scanMax, hasRewardSignal, guessType } from "./google";

let saved: Record<string, string | undefined>;
const KEYS = ["GMAIL_SCAN_MODE", "GMAIL_SCAN_WINDOW", "GMAIL_SCAN_MAX"];
beforeEach(() => {
  saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe("scanWindow", () => {
  it("defaults to 6 months and accepts valid overrides", () => {
    expect(scanWindow()).toBe("6m");
    process.env.GMAIL_SCAN_WINDOW = "1y";
    expect(scanWindow()).toBe("1y");
    process.env.GMAIL_SCAN_WINDOW = "90d";
    expect(scanWindow()).toBe("90d");
  });
  it("rejects garbage and falls back to 6m", () => {
    process.env.GMAIL_SCAN_WINDOW = "forever";
    expect(scanWindow()).toBe("6m");
  });
});

describe("scanMax", () => {
  it("defaults to 60 and clamps", () => {
    expect(scanMax()).toBe(60);
    process.env.GMAIL_SCAN_MAX = "25";
    expect(scanMax()).toBe(25);
    process.env.GMAIL_SCAN_MAX = "9999";
    expect(scanMax()).toBe(200); // clamped
    process.env.GMAIL_SCAN_MAX = "0";
    expect(scanMax()).toBe(60); // invalid → default
  });
});

describe("scanQuery", () => {
  it("rewards mode (default) filters to reward keywords over the window", () => {
    const q = scanQuery();
    expect(q).toContain("newer_than:6m");
    expect(q).toContain("reward points");
    expect(q).toContain("points");
    expect(q).toContain("miles");
    expect(q).toContain("statement credit");
    expect(q).toContain("gift card");
  });
  it("respects the window override + mode", () => {
    process.env.GMAIL_SCAN_WINDOW = "1y";
    process.env.GMAIL_SCAN_MODE = "promotions";
    expect(scanQuery()).toBe("category:promotions newer_than:1y");
    process.env.GMAIL_SCAN_MODE = "full";
    expect(scanQuery()).toBe("newer_than:1y");
  });
});

describe("hasRewardSignal", () => {
  it("accepts reward-looking text incl. points/miles/statements", () => {
    expect(hasRewardSignal("You earned 5,000 reward points")).toBe(true);
    expect(hasRewardSignal("HDFC statement credit of ₹500")).toBe(true);
    expect(hasRewardSignal("$20 off your next order")).toBe(true);
    expect(hasRewardSignal("Your air miles are expiring")).toBe(true);
  });
  it("rejects non-reward text", () => {
    expect(hasRewardSignal("Your package was delivered")).toBe(false);
  });
});

describe("guessType", () => {
  it("maps card reward points and statement credits correctly", () => {
    expect(guessType("You earned 5000 reward points on your HDFC card")).toBe("points");
    expect(guessType("Amex statement credit applied")).toBe("cashback");
    expect(guessType("Target e-gift card $50")).toBe("giftcard");
    expect(guessType("Use promo code SAVE20 for 20% off")).toBe("coupon");
  });
});
