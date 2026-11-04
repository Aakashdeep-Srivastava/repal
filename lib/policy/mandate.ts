import type { Mandate } from "@/lib/types";
import { canonicalJson } from "@/lib/receipts/canonical";

/**
 * Mandate signing / verification helpers.
 *
 * The mandate IS the agent's scoped authority (a PayPal Vault token, cap,
 * budget, allow-list, approval threshold). We sign its canonical form so the
 * policy gate can prove it was not tampered with. OWNER: Rachandeep Kaur.
 */

/**
 * Stable canonical JSON of exactly the Mandate contract fields (keys sorted,
 * absent paypalVaultTokenId omitted). Extra DB columns (userId, status,
 * signatureHash) are not part of the Mandate type and are excluded.
 */
export function canonicalizeMandate(mandate: Mandate): string {
  return canonicalJson({
    id: mandate.id,
    capUsd: mandate.capUsd,
    budgetUsd: mandate.budgetUsd,
    approvalThresholdUsd: mandate.approvalThresholdUsd,
    allowCategories: mandate.allowCategories,
    allowMerchants: mandate.allowMerchants,
    expiresAt: mandate.expiresAt,
    paypalVaultTokenId: mandate.paypalVaultTokenId ?? undefined,
  });
}

export function signMandate(_mandate: Mandate): string {
  // TODO(rachan): BLOCKED on a decision — the spec says "SHA-256 of canonical
  // form (reuse lib/receipts signing key)", which mixes a plain hash with a
  // keyed signature. Confirm with Aakash which one `signatureHash` should hold
  // and which fields it must cover (e.g. userId).
  throw new Error("signMandate() not implemented");
}
