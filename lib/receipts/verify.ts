import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { hashReceipt, loadSigningKey, type ReceiptLike } from "@/lib/receipts";

/**
 * verifyReceipt — recompute the hash and check the Ed25519 signature.
 * Powers the public /verify/:id page. DETERMINISTIC. OWNER: Rachandeep Kaur.
 *
 * Returns false (never throws) for a tampered receipt or a malformed signature.
 * Throws only if the verification key itself is unavailable.
 */
export type VerifiableReceipt = ReceiptLike & { sha256: string; signature: string };

/** Public key derived from RECEIPT_SIGNING_KEY. */
export function getVerifyKey(): KeyObject {
  return createPublicKey(loadSigningKey());
}

export function verifyReceipt(
  receipt: VerifiableReceipt,
  publicKey: KeyObject = getVerifyKey(),
): boolean {
  let recomputed: string;
  try {
    recomputed = hashReceipt(receipt);
  } catch {
    return false;
  }
  if (recomputed !== receipt.sha256) return false;

  try {
    return verify(
      null,
      Buffer.from(receipt.sha256, "utf8"),
      publicKey,
      Buffer.from(receipt.signature, "base64"),
    );
  } catch {
    return false;
  }
}
