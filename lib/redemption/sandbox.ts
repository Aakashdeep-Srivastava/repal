/**
 * SandboxRedemptionAdapter — a LABELLED, deterministic stand-in for a real merchant /
 * affiliate confirmation. It lets the full confirmation → settlement path run end-to-end
 * without a signed commercial partner, so the architecture is proven and tested before
 * one exists.
 *
 * HONESTY: every result reports `simulated: true`. A sandbox confirmation is NOT evidence
 * that a merchant accepted a redemption — only that the plumbing works. Do not surface it
 * to a user or a partner as a real confirmation.
 *
 * Deterministic conventions (no randomness, so tests are stable and behaviour is auditable):
 *   - a code of `null`/empty for a code-less offer validates (nothing to present);
 *   - a code that starts with "DECLINE" is rejected at confirm — exercises the decline path;
 *   - everything else confirms with ref `SANDBOX-<redemptionId>`.
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

export class SandboxRedemptionAdapter implements RedemptionAdapter {
  readonly source = "sandbox";
  readonly simulated = true;

  async validate(req: ValidateRequest): Promise<ValidateResult> {
    const code = req.code?.trim();
    if (req.code != null && code === "") {
      return { valid: false, reason: "empty_code" };
    }
    return { valid: true, normalizedCode: code ? code.toUpperCase() : null };
  }

  async confirm(req: ConfirmRequest): Promise<ConfirmResult> {
    const code = req.code?.trim().toUpperCase();
    if (code && code.startsWith("DECLINE")) {
      return { confirmed: false, reason: "merchant_declined", simulated: true };
    }
    return {
      confirmed: true,
      confirmationRef: `SANDBOX-${req.redemptionId}`,
      simulated: true,
    };
  }

  async reverse(_req: ReverseRequest): Promise<ReverseResult> {
    return { acknowledged: true, simulated: true };
  }
}
