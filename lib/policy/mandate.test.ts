import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import {
  canonicalizeMandate,
  canonicalizeSignedMandate,
  signMandate,
  verifyMandate,
} from "./mandate";
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

const { privateKey } = generateKeyPairSync("ed25519");
const KEY_B64 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

let prevEnv: string | undefined;
beforeAll(() => {
  prevEnv = process.env.RECEIPT_SIGNING_KEY;
  process.env.RECEIPT_SIGNING_KEY = KEY_B64;
});
afterAll(() => {
  if (prevEnv === undefined) delete process.env.RECEIPT_SIGNING_KEY;
  else process.env.RECEIPT_SIGNING_KEY = prevEnv;
});

describe("canonicalizeSignedMandate", () => {
  it("binds userId into the canonical form", () => {
    const c = canonicalizeSignedMandate(m, "demo-user");
    expect(c).toContain('"userId":"demo-user"');
    expect(c).not.toBe(canonicalizeMandate(m));
  });

  it("differs per user for the same mandate", () => {
    expect(canonicalizeSignedMandate(m, "user-a")).not.toBe(
      canonicalizeSignedMandate(m, "user-b"),
    );
  });
});

describe("signMandate / verifyMandate", () => {
  it("round-trips with the env key", () => {
    const sig = signMandate(m, "demo-user");
    expect(Buffer.from(sig, "base64")).toHaveLength(64);
    expect(verifyMandate(m, "demo-user", sig)).toBe(true);
  });

  it("rejects a tampered authority field", () => {
    const sig = signMandate(m, "demo-user");
    expect(verifyMandate({ ...m, capUsd: 99999 }, "demo-user", sig)).toBe(false);
  });

  it("rejects the same mandate presented under a different user", () => {
    const sig = signMandate(m, "demo-user");
    expect(verifyMandate(m, "someone-else", sig)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    const sig = signMandate(m, "demo-user", other);
    expect(verifyMandate(m, "demo-user", sig)).toBe(false);
    expect(verifyMandate(m, "demo-user", sig, createPublicKey(other))).toBe(true);
  });

  it("returns false (not throw) for a malformed signature", () => {
    expect(verifyMandate(m, "demo-user", "not-base64!!")).toBe(false);
    expect(verifyMandate(m, "demo-user", "")).toBe(false);
  });
});
