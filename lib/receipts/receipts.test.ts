import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync, createPublicKey, createHash } from "node:crypto";
import { canonicalize, hashReceipt, signReceipt, loadSigningKey, type ReceiptInput } from "./index";
import { verifyReceipt } from "./verify";

const { privateKey } = generateKeyPairSync("ed25519");
const KEY_B64 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

const input: ReceiptInput = {
  userId: "demo-user",
  runId: "run_1",
  item: "Sony WH-1000XM5",
  merchant: "bestbuy.com",
  category: "headphones",
  priceUsd: 248,
  savedUsd: 40,
  cashUsd: 208,
  paypalOrderId: "ORDER123",
  paypalCaptureId: "CAP456",
};

let prevEnv: string | undefined;
beforeAll(() => {
  prevEnv = process.env.RECEIPT_SIGNING_KEY;
  process.env.RECEIPT_SIGNING_KEY = KEY_B64;
});
afterAll(() => {
  if (prevEnv === undefined) delete process.env.RECEIPT_SIGNING_KEY;
  else process.env.RECEIPT_SIGNING_KEY = prevEnv;
});

describe("canonicalize", () => {
  it("is independent of key order", () => {
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as ReceiptInput;
    expect(canonicalize(reordered)).toBe(canonicalize(input));
  });

  it("includes only ReceiptInput fields (DB extras ignored)", () => {
    const dbRow = { ...input, id: "rcpt_1", createdAt: "2026-11-03", sha256: "x", signature: "y" };
    expect(canonicalize(dbRow)).toBe(canonicalize(input));
  });

  it("treats null optional fields as absent", () => {
    expect(canonicalize({ ...input, payoutBatchId: null, fxInrPerUsd: null })).toBe(
      canonicalize(input),
    );
  });

  it("includes optional fields when present", () => {
    const c = canonicalize({ ...input, payoutBatchId: "B1", fxInrPerUsd: 84 });
    expect(c).toContain('"payoutBatchId":"B1"');
    expect(c).toContain('"fxInrPerUsd":84');
  });

  it("throws on a missing required field", () => {
    const { paypalCaptureId: _omit, ...rest } = input;
    expect(() => canonicalize(rest as ReceiptInput)).toThrow(/paypalCaptureId/);
  });
});

describe("hashReceipt", () => {
  it("is lowercase hex SHA-256 of the canonical form", () => {
    const expected = createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
    expect(hashReceipt(input)).toBe(expected);
    expect(hashReceipt(input)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("signReceipt / verifyReceipt", () => {
  it("round-trips with the env key", () => {
    const signed = signReceipt(input);
    expect(signed.sha256).toBe(hashReceipt(input));
    expect(Buffer.from(signed.signature, "base64")).toHaveLength(64);
    expect(verifyReceipt(signed)).toBe(true);
  });

  it("verifies a DB-shaped row (nulls + extra columns)", () => {
    const signed = signReceipt(input);
    const row = { ...signed, id: "rcpt_1", payoutBatchId: null, fxInrPerUsd: null };
    expect(verifyReceipt(row)).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const signed = signReceipt(input);
    expect(verifyReceipt({ ...signed, cashUsd: 1 })).toBe(false);
  });

  it("rejects a tampered hash even if recomputed consistently", () => {
    const signed = signReceipt(input);
    const forged = { ...signed, cashUsd: 1 };
    expect(verifyReceipt({ ...forged, sha256: hashReceipt(forged) })).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    const signed = signReceipt(input, other);
    expect(verifyReceipt(signed)).toBe(false);
    expect(verifyReceipt(signed, createPublicKey(other))).toBe(true);
  });

  it("returns false (not throw) for a malformed signature", () => {
    const signed = signReceipt(input);
    expect(verifyReceipt({ ...signed, signature: "not-base64!!" })).toBe(false);
    expect(verifyReceipt({ ...signed, signature: "" })).toBe(false);
  });
});

describe("loadSigningKey", () => {
  it("throws a helpful error when the key is missing", () => {
    expect(() => loadSigningKey("")).toThrow(/RECEIPT_SIGNING_KEY/);
  });

  it("rejects a non-Ed25519 key", () => {
    const { privateKey: ec } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const b64 = ec.export({ type: "pkcs8", format: "der" }).toString("base64");
    expect(() => loadSigningKey(b64)).toThrow(/must be Ed25519/);
  });
});
