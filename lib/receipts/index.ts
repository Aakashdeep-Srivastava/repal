/**
 * Receipt agent (A8) — canonical JSON → SHA-256 → Ed25519 signature.
 *
 * DETERMINISTIC. Produces the signed decision receipt verified at /verify/:id.
 * OWNER: Rachandeep Kaur (signing key provisioning: Aakash, see .env.example).
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

export function canonicalize(_input: ReceiptInput): string {
  // TODO(rachna): stable key ordering → canonical JSON string.
  throw new Error("canonicalize() not implemented");
}

export function signReceipt(_input: ReceiptInput): SignedReceipt {
  // TODO(rachna): sha256(canonicalize(input)); Ed25519 sign with
  // RECEIPT_SIGNING_KEY (base64). Node crypto, no external deps needed.
  throw new Error("signReceipt() not implemented");
}
