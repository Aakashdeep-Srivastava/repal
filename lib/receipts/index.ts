import { createHash, createPrivateKey, sign, type KeyObject } from "node:crypto";
import { canonicalJson } from "@/lib/receipts/canonical";

/**
 * Receipt agent (A8) — canonical JSON → SHA-256 → Ed25519 signature.
 *
 * DETERMINISTIC. Produces the signed decision receipt verified at /verify/:id.
 * OWNER: Rachandeep Kaur (signing key provisioning: Aakash, see .env.example).
 *
 * Encoding contract (shared with verify.ts and any external verifier):
 *  - canonical form: only the ReceiptInput fields below, keys sorted, optional
 *    fields that are null/undefined omitted (so a DB row with `null` verifies
 *    the same as the original input with `undefined`).
 *  - sha256: lowercase hex of SHA-256(UTF-8 canonical JSON).
 *  - signature: base64 Ed25519 signature over the UTF-8 bytes of the sha256 hex
 *    string.
 *  - key: RECEIPT_SIGNING_KEY = base64 PKCS#8 DER Ed25519 private key
 *    (generated as in docs/PAYPAL_SETUP.md §5).
 */

export interface ReceiptInput {
  userId: string;
  runId: string;
  item: string;
  merchant: string;
  category: string;
  priceUsd: number;
  savedUsd: number;
  cashUsd: number;
  paypalOrderId: string;
  paypalCaptureId: string;
  payoutBatchId?: string;
  fxInrPerUsd?: number;
}

export interface SignedReceipt extends ReceiptInput {
  sha256: string;
  signature: string; // Ed25519 over the sha256
}

/** Accepts DB rows too, where absent optional fields come back as `null`. */
export type ReceiptLike = Omit<ReceiptInput, "payoutBatchId" | "fxInrPerUsd"> & {
  payoutBatchId?: string | null;
  fxInrPerUsd?: number | null;
};

const REQUIRED_FIELDS = [
  "userId",
  "runId",
  "item",
  "merchant",
  "category",
  "priceUsd",
  "savedUsd",
  "cashUsd",
  "paypalOrderId",
  "paypalCaptureId",
] as const;
const OPTIONAL_FIELDS = ["payoutBatchId", "fxInrPerUsd"] as const;

/** Stable canonical JSON over exactly the ReceiptInput fields. */
export function canonicalize(input: ReceiptLike): string {
  const picked: Record<string, unknown> = {};
  for (const k of REQUIRED_FIELDS) {
    if (input[k] === undefined || input[k] === null) {
      throw new Error(`canonicalize: missing required receipt field "${k}"`);
    }
    picked[k] = input[k];
  }
  for (const k of OPTIONAL_FIELDS) {
    const v = input[k];
    if (v !== undefined && v !== null) picked[k] = v;
  }
  return canonicalJson(picked);
}

/** Lowercase hex SHA-256 of the canonical form. */
export function hashReceipt(input: ReceiptLike): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

/** Load the Ed25519 private key from RECEIPT_SIGNING_KEY (base64 PKCS#8 DER). */
export function loadSigningKey(b64: string | undefined = process.env.RECEIPT_SIGNING_KEY): KeyObject {
  if (!b64) {
    throw new Error(
      "Missing RECEIPT_SIGNING_KEY (base64 PKCS#8 Ed25519). See docs/PAYPAL_SETUP.md §5.",
    );
  }
  const key = createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`RECEIPT_SIGNING_KEY must be Ed25519, got ${key.asymmetricKeyType}`);
  }
  return key;
}

export function signReceipt(input: ReceiptInput, privateKey: KeyObject = loadSigningKey()): SignedReceipt {
  const sha256 = hashReceipt(input);
  const signature = sign(null, Buffer.from(sha256, "utf8"), privateKey).toString("base64");
  return { ...input, sha256, signature };
}
