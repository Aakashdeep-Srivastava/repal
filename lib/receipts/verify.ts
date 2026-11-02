import type { SignedReceipt } from "@/lib/receipts";

/**
 * verifyReceipt — recompute the hash and check the Ed25519 signature.
 * Powers the public /verify/:id page. DETERMINISTIC. OWNER: Rachandeep Kaur.
 */
export function verifyReceipt(_receipt: SignedReceipt): boolean {
  // TODO(rachna): recompute sha256 from canonical form; verify signature with
  // the public key derived from RECEIPT_SIGNING_KEY.
  throw new Error("verifyReceipt() not implemented");
}
