/**
 * Redemption confirmation layer (Phase 3). Resolves which RedemptionAdapter confirms a
 * given redemption and re-exports the confirmation entrypoint + types.
 *
 * Resolution: if a real affiliate/merchant network is wired (env AFFILIATE_API_URL +
 * AFFILIATE_API_KEY) use the AffiliateHttpAdapter; otherwise fall back to the LABELLED
 * SandboxRedemptionAdapter. The fallback is honest — its confirmations report
 * `simulated: true` and must never be presented as a real merchant confirmation.
 */
import type { RedemptionAdapter } from "./types";
import { SandboxRedemptionAdapter } from "./sandbox";
import { AffiliateHttpAdapter, affiliateConfigFromEnv } from "./affiliate";

export * from "./types";
export { confirmRedemption, RedemptionConfirmError, type ConfirmRedemptionResult } from "./confirm";
export { SandboxRedemptionAdapter } from "./sandbox";
export { AffiliateHttpAdapter, affiliateConfigFromEnv, type AffiliateConfig } from "./affiliate";

export interface AdapterSelection {
  /** Force the labelled sandbox even if a network is configured (tests, demos). */
  forceSandbox?: boolean;
}

/**
 * The adapter that should confirm redemptions for a merchant. Today, with no network
 * wired, this returns the sandbox adapter in every environment — a deliberate, labelled
 * placeholder, not a claim of real merchant integration.
 */
export function getRedemptionAdapter(opts: AdapterSelection = {}): RedemptionAdapter {
  if (!opts.forceSandbox) {
    const cfg = affiliateConfigFromEnv();
    if (cfg) return new AffiliateHttpAdapter(cfg);
  }
  return new SandboxRedemptionAdapter();
}

/** True when a real (non-simulated) confirmation network is wired. */
export function hasRealRedemptionNetwork(): boolean {
  return affiliateConfigFromEnv() != null;
}
