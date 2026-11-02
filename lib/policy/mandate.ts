import type { Mandate } from "@/lib/types";

/**
 * Mandate signing / verification helpers.
 *
 * The mandate IS the agent's scoped authority (a PayPal Vault token, cap,
 * budget, allow-list, approval threshold). We sign its canonical form so the
 * policy gate can prove it was not tampered with. OWNER: Rachandeep Kaur.
 */
export function canonicalizeMandate(_mandate: Mandate): string {
  // TODO(rachna): stable key ordering → canonical JSON string.
  throw new Error("canonicalizeMandate() not implemented");
}

export function signMandate(_mandate: Mandate): string {
  // TODO(rachna): SHA-256 of canonical form (reuse lib/receipts signing key).
  throw new Error("signMandate() not implemented");
}
