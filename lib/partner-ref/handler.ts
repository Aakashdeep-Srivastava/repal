/**
 * Reference partner — a RUNNING reference implementation of the redemption-confirmation
 * contract a real merchant / affiliate network must expose for RePal's Phase 4 pilot.
 *
 * WHAT IT IS: the concrete endpoint `AffiliateHttpAdapter` (lib/redemption/affiliate.ts)
 * talks to, so the entire real-network code path — bearer auth, JSON confirm/validate/
 * reverse, error/timeout handling — runs end-to-end against a genuine HTTP server.
 *
 * WHAT IT IS NOT: a signed commercial partner. It is a deterministic stand-in. It proves
 * the PLUMBING works; it does NOT prove real partner economics (that needs a real partner
 * — the thing Phase 4 is gated on). Keep this distinction in every surface that uses it.
 *
 * The real partner swaps this out by pointing AFFILIATE_API_URL at their own host; the
 * request/response shapes below ARE the contract they implement.
 */

export type PartnerAction = "validate" | "confirm" | "reverse";

export interface PartnerRequestBody {
  redemptionId?: string;
  code?: string | null;
  offerId?: string | null;
  merchantId?: string;
  netPaidCents?: number;
  confirmationRef?: string | null;
  reason?: string;
}

export interface PartnerResponse {
  status: number;
  json: Record<string, unknown>;
}

/** Stable, deterministic confirmation reference for a redemption (no randomness). */
export function referenceFor(redemptionId: string): string {
  return `PARTNER-REF-${redemptionId}`;
}

/**
 * The reference partner's decision logic. Deterministic + auditable:
 *   - unauthorized → 401;
 *   - validate: a code-less request is valid; a blank presented code is not;
 *   - confirm: confirmed unless the code starts with "DECLINE" (lets callers exercise
 *     a genuine merchant decline), otherwise returns a stable `reference`;
 *   - reverse: always acknowledged.
 */
export function handlePartnerRef(
  action: PartnerAction,
  body: PartnerRequestBody,
  authorized: boolean,
): PartnerResponse {
  if (!authorized) {
    return { status: 401, json: { error: "unauthorized" } };
  }

  const code = typeof body.code === "string" ? body.code.trim() : body.code;

  if (action === "validate") {
    if (body.code != null && code === "") {
      return { status: 200, json: { valid: false, reason: "empty_code" } };
    }
    return { status: 200, json: { valid: true, normalizedCode: code ? code.toUpperCase() : null } };
  }

  if (action === "confirm") {
    const rid = body.redemptionId ?? "";
    if (!rid) return { status: 400, json: { confirmed: false, reason: "missing_redemptionId" } };
    if (code && code.toUpperCase().startsWith("DECLINE")) {
      return { status: 200, json: { confirmed: false, reason: "merchant_declined" } };
    }
    return { status: 200, json: { confirmed: true, reference: referenceFor(rid) } };
  }

  // reverse
  return { status: 200, json: { ok: true } };
}

/** Parses the trailing path segment into a known action, or null. */
export function parseAction(segment: string | undefined): PartnerAction | null {
  return segment === "validate" || segment === "confirm" || segment === "reverse" ? segment : null;
}
