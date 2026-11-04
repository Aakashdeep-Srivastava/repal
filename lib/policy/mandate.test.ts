import { describe, it, expect } from "vitest";
import { canonicalizeMandate } from "./mandate";
import type { Mandate } from "@/lib/types";

const m: Mandate = {
  id: "m_1",
  capUsd: 300,
  budgetUsd: 500,
  approvalThresholdUsd: 200,
  allowCategories: ["electronics", "audio"],
  allowMerchants: [],
  expiresAt: "2027-01-31T00:00:00.000Z",
};

describe("canonicalizeMandate", () => {
  it("produces sorted-key canonical JSON", () => {
    expect(canonicalizeMandate(m)).toBe(
      '{"allowCategories":["electronics","audio"],"allowMerchants":[],' +
        '"approvalThresholdUsd":200,"budgetUsd":500,"capUsd":300,' +
        '"expiresAt":"2027-01-31T00:00:00.000Z","id":"m_1"}',
    );
  });

  it("ignores extra DB columns", () => {
    const row = { ...m, userId: "u", status: "active", signatureHash: "x" } as Mandate;
    expect(canonicalizeMandate(row)).toBe(canonicalizeMandate(m));
  });

  it("includes the vault token when present, omits it when null", () => {
    expect(canonicalizeMandate({ ...m, paypalVaultTokenId: "tok" })).toContain(
      '"paypalVaultTokenId":"tok"',
    );
    const withNull = { ...m, paypalVaultTokenId: null } as unknown as Mandate;
    expect(canonicalizeMandate(withNull)).toBe(canonicalizeMandate(m));
  });

  it("changes when any authority field changes", () => {
    expect(canonicalizeMandate({ ...m, capUsd: 301 })).not.toBe(canonicalizeMandate(m));
    expect(canonicalizeMandate({ ...m, allowMerchants: ["bestbuy.com"] })).not.toBe(
      canonicalizeMandate(m),
    );
  });
});
