import { createHash, sign, verify, type KeyObject } from "node:crypto";
import type { Mandate } from "@/lib/types";
import { canonicalJson } from "@/lib/receipts/canonical";
import { loadSigningKey } from "@/lib/receipts";
import { getVerifyKey } from "@/lib/receipts/verify";

/**
 * Mandate signing / verification helpers.
 *
 * The mandate IS the agent's scoped authority (a PayPal Vault token, cap,
 * budget, allow-list, approval threshold). We sign its canonical form so the
 * policy gate can prove it was not tampered with. OWNER: Rachandeep Kaur
 * (canonical form); signing contract decided with Aakash (see below).
 *
 * Signing contract (resolves the "hash vs signature" question):
 *  - `Mandate.signatureHash` holds a KEYED Ed25519 signature, NOT a bare
 *    SHA-256 — a plain hash is not tamper-evident (anyone can recompute it
 *    after editing a cap). Construction is identical to lib/receipts:
 *      canonical JSON → sha256 (hex) → Ed25519 sign over the hex → base64.
 *  - The signed payload COVERS `userId` in addition to the authority fields,
 *    so a signature cannot be replayed onto a different user's mandate. Because
 *    `userId` is a DB column (not part of the `Mandate` contract type), it is
 *    passed explicitly to signMandate/verifyMandate.
 *  - Reuses the same RECEIPT_SIGNING_KEY as lib/receipts (one team key).
 */

/** The authority fields of a mandate, in Mandate-contract shape. */
function mandateFields(m: Mandate) {
  return {
    id: m.id,
    capUsd: m.capUsd,
    budgetUsd: m.budgetUsd,
    approvalThresholdUsd: m.approvalThresholdUsd,
    allowCategories: m.allowCategories,
    allowMerchants: m.allowMerchants,
    expiresAt: m.expiresAt,
    paypalVaultTokenId: m.paypalVaultTokenId ?? undefined,
  };
}

/**
 * Stable canonical JSON of exactly the Mandate contract fields (keys sorted,
 * absent paypalVaultTokenId omitted). Extra DB columns (userId, status,
 * signatureHash) are not part of the Mandate type and are excluded. Used for
 * display / equality; the SIGNED form (below) additionally binds userId.
 */
export function canonicalizeMandate(mandate: Mandate): string {
  return canonicalJson(mandateFields(mandate));
}

/**
 * Canonical form that is actually SIGNED: the mandate's authority fields plus
 * the owning userId. Distinct from canonicalizeMandate() so the signature is
 * bound to the user it was issued to.
 */
export function canonicalizeSignedMandate(mandate: Mandate, userId: string): string {
  return canonicalJson({ userId, ...mandateFields(mandate) });
}

/** Lowercase hex SHA-256 of the signed canonical form. */
export function hashMandate(mandate: Mandate, userId: string): string {
  return createHash("sha256")
    .update(canonicalizeSignedMandate(mandate, userId), "utf8")
    .digest("hex");
}

/**
 * Ed25519 signature (base64) for (mandate, userId). This is the value stored in
 * `Mandate.signatureHash`. Signs the sha256 hex of the canonical form — the
 * same construction lib/receipts uses for decision receipts.
 */
export function signMandate(
  mandate: Mandate,
  userId: string,
  privateKey: KeyObject = loadSigningKey(),
): string {
  const hash = hashMandate(mandate, userId);
  return sign(null, Buffer.from(hash, "utf8"), privateKey).toString("base64");
}

/**
 * True iff `signatureHash` is a valid Ed25519 signature for (mandate, userId).
 * Returns false (never throws) on a tampered mandate or a malformed signature;
 * throws only if the verification key itself is unavailable.
 */
export function verifyMandate(
  mandate: Mandate,
  userId: string,
  signatureHash: string,
  publicKey: KeyObject = getVerifyKey(),
): boolean {
  let hash: string;
  try {
    hash = hashMandate(mandate, userId);
  } catch {
    return false;
  }
  try {
    return verify(
      null,
      Buffer.from(hash, "utf8"),
      publicKey,
      Buffer.from(signatureHash, "base64"),
    );
  } catch {
    return false;
  }
}
