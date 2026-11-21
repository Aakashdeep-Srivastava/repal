/**
 * RedemptionAdapter — the boundary between RePal's *internal* eligibility decision
 * and a merchant / affiliate network's *authoritative* confirmation of a redemption.
 *
 * WHY THIS EXISTS (Phase 3): RePal's optimizer deciding a coupon applies is NOT the
 * same as the merchant accepting it. A commission only becomes payable once the
 * party that owes it confirms the redemption actually happened. Every adapter below
 * implements that confirmation handshake for one source of truth.
 *
 * HONESTY: `simulated` is load-bearing. The `sandbox` adapter confirms deterministically
 * with no real counterparty and MUST report `simulated: true` on every result — never
 * present a simulated confirmation as a real merchant/affiliate confirmation. A real
 * network adapter reports `simulated: false` and only confirms on a genuine response.
 *
 * All amounts are integer cents; adapters never compute money (no LLM, no pricing).
 */

export interface ValidateRequest {
  /** Coupon code the consumer presented, if any (null for a code-less offer). */
  code?: string | null;
  /** CatalogOffer id, if the redemption came from the catalog. */
  offerId?: string | null;
  merchantId: string;
  userId: string;
}

export interface ValidateResult {
  valid: boolean;
  /** Machine reason when `valid` is false, e.g. "empty_code", "adapter_not_configured". */
  reason?: string;
  /** Canonical form of the code the merchant recognizes, if it normalized one. */
  normalizedCode?: string | null;
}

export interface ConfirmRequest {
  redemptionId: string;
  code?: string | null;
  offerId?: string | null;
  merchantId: string;
  /** What PayPal actually moved — passed so a network can reconcile against its own total. */
  netPaidCents: number;
}

export interface ConfirmResult {
  confirmed: boolean;
  /** The counterparty's confirmation reference (receipt/affiliate id), stored on the redemption. */
  confirmationRef?: string | null;
  /** Machine reason when `confirmed` is false, e.g. "merchant_declined", "adapter_not_configured". */
  reason?: string;
  /** TRUE when no real counterparty was contacted (sandbox). Never claim a real confirmation. */
  simulated: boolean;
}

export interface ReverseRequest {
  redemptionId: string;
  confirmationRef?: string | null;
  merchantId: string;
  reason: string;
}

export interface ReverseResult {
  acknowledged: boolean;
  reason?: string;
  simulated: boolean;
}

/**
 * One external source of redemption truth (a merchant integration, an affiliate
 * network, or the labelled sandbox). Deterministic + side-effect-scoped: it talks to
 * its counterparty and reports a verdict; it never writes RePal's ledger (that is
 * `confirmRedemption`'s job).
 */
export interface RedemptionAdapter {
  /** Stable identifier recorded as `Redemption.confirmationSource`, e.g. "sandbox", "affiliate:acme". */
  readonly source: string;
  /** TRUE if this adapter has no real counterparty. See the honesty note above. */
  readonly simulated: boolean;
  validate(req: ValidateRequest): Promise<ValidateResult>;
  confirm(req: ConfirmRequest): Promise<ConfirmResult>;
  reverse(req: ReverseRequest): Promise<ReverseResult>;
}
