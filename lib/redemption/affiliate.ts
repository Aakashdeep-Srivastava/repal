/**
 * AffiliateHttpAdapter — the real-network integration shape, DORMANT until a genuine
 * affiliate/merchant network is wired. It is the template Phase 4 fills in with one
 * authorized partner; today no credentials exist, so `isConfigured()` is false in prod
 * and every method returns a non-confirming `adapter_not_configured` result (it never
 * throws, never fabricates a confirmation, never falls back to "simulated success").
 *
 * When configured (env: AFFILIATE_API_URL, AFFILIATE_API_KEY, optional AFFILIATE_NETWORK),
 * it performs the genuine handshake: a POST to the network's confirmation endpoint, and
 * reports `confirmed` strictly from the network's own response. `simulated` is always
 * false — this adapter either reaches a real counterparty or declines; it never pretends.
 */
import type {
  RedemptionAdapter,
  ValidateRequest,
  ValidateResult,
  ConfirmRequest,
  ConfirmResult,
  ReverseRequest,
  ReverseResult,
} from "./types";

export interface AffiliateConfig {
  apiUrl: string;
  apiKey: string;
  network?: string;
  /** Abort each network call after this many ms (default 8000). */
  timeoutMs?: number;
}

/** Reads config from env; returns null when the network is not wired (the prod default today). */
export function affiliateConfigFromEnv(): AffiliateConfig | null {
  const apiUrl = process.env.AFFILIATE_API_URL;
  const apiKey = process.env.AFFILIATE_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl, apiKey, network: process.env.AFFILIATE_NETWORK || "network" };
}

const NOT_CONFIGURED = "adapter_not_configured";

export class AffiliateHttpAdapter implements RedemptionAdapter {
  readonly simulated = false;
  readonly source: string;
  private readonly cfg: AffiliateConfig | null;

  constructor(cfg: AffiliateConfig | null) {
    this.cfg = cfg;
    this.source = `affiliate:${cfg?.network ?? "unconfigured"}`;
  }

  isConfigured(): boolean {
    return this.cfg != null;
  }

  private async post(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
    const cfg = this.cfg!;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000);
    try {
      const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        /* non-JSON body — treat as empty */
      }
      return { ok: res.ok, status: res.status, json };
    } finally {
      clearTimeout(t);
    }
  }

  async validate(req: ValidateRequest): Promise<ValidateResult> {
    if (!this.cfg) return { valid: false, reason: NOT_CONFIGURED };
    try {
      const { ok, json } = await this.post("/redemptions/validate", {
        code: req.code ?? null,
        offerId: req.offerId ?? null,
        merchantId: req.merchantId,
      });
      if (!ok) return { valid: false, reason: "network_error" };
      return {
        valid: Boolean(json.valid),
        reason: typeof json.reason === "string" ? json.reason : undefined,
        normalizedCode: typeof json.normalizedCode === "string" ? json.normalizedCode : (req.code ?? null),
      };
    } catch {
      return { valid: false, reason: "network_unreachable" };
    }
  }

  async confirm(req: ConfirmRequest): Promise<ConfirmResult> {
    if (!this.cfg) return { confirmed: false, reason: NOT_CONFIGURED, simulated: false };
    try {
      const { ok, json } = await this.post("/redemptions/confirm", {
        redemptionId: req.redemptionId,
        code: req.code ?? null,
        offerId: req.offerId ?? null,
        merchantId: req.merchantId,
        netPaidCents: req.netPaidCents,
      });
      if (!ok) return { confirmed: false, reason: "network_error", simulated: false };
      // Confirmation is strictly the network's verdict — never inferred.
      const confirmed = Boolean(json.confirmed);
      const ref = typeof json.reference === "string" ? json.reference : null;
      return {
        confirmed,
        confirmationRef: confirmed ? ref : null,
        reason: !confirmed && typeof json.reason === "string" ? json.reason : undefined,
        simulated: false,
      };
    } catch {
      return { confirmed: false, reason: "network_unreachable", simulated: false };
    }
  }

  async reverse(req: ReverseRequest): Promise<ReverseResult> {
    if (!this.cfg) return { acknowledged: false, reason: NOT_CONFIGURED, simulated: false };
    try {
      const { ok } = await this.post("/redemptions/reverse", {
        redemptionId: req.redemptionId,
        confirmationRef: req.confirmationRef ?? null,
        merchantId: req.merchantId,
        reason: req.reason,
      });
      return { acknowledged: ok, reason: ok ? undefined : "network_error", simulated: false };
    } catch {
      return { acknowledged: false, reason: "network_unreachable", simulated: false };
    }
  }
}
