import { tool, type Tool } from "ai";
import type { z } from "zod";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";

/**
 * PayPal Agent Toolkit adapter — wires PayPal's OFFICIAL agent tools into RePal's
 * AI SDK v7 orchestrator. See docs/AGENTIC_COMMERCE.md.
 *
 * ── Why an adapter and not a direct spread ──────────────────────────────────
 * `@paypal/agent-toolkit` (v1.11) bundles its OWN `ai@4` as a direct dependency
 * and builds its tools with v4's `tool({ parameters, execute })`. RePal runs
 * `ai@7`, whose `tool()` uses `inputSchema`. Spreading `getTools()` straight into
 * a v7 agent is unsafe (the v4 tool shape isn't understood by the v7 runtime).
 *
 * Because both packages resolve the SAME top-level `zod@3.25`, each toolkit tool
 * exposes a `{ description, parameters (zod), execute }` we can safely lift: we
 * re-wrap it as a v7 `tool({ inputSchema: parameters, execute })`. `execute` is
 * version-agnostic (it just calls PayPal REST), so the lift is lossless.
 *
 * ── Safety: the mandate still owns spending ─────────────────────────────────
 * We expose ONLY post-purchase / read commerce tools (order status, shipment
 * tracking, disputes, transactions, invoice/plan reads). The money-moving
 * toolkit tools (`create_order`, `pay_order`, `create_refund`) are intentionally
 * NOT exposed — RePal's deterministic, mandate-gated path (`plan_purchase` →
 * `gateSpend` → `pay`/`payout`) remains the ONLY way money moves, preserving the
 * "LLM never computes money" invariant.
 *
 * Feature-flagged (`PAYPAL_AGENT_TOOLKIT`), OFF by default, so enabling it is
 * purely additive and nothing that already works changes until you opt in.
 */

/** Is the official PayPal Agent Toolkit wired into the agent? (off by default) */
export function isPayPalToolkitEnabled(): boolean {
  const v = process.env.PAYPAL_AGENT_TOOLKIT;
  return v === "1" || v === "true";
}

/**
 * The SAFE commerce actions we surface to the agent — ones that EXTEND the
 * commerce loop (post-purchase, trust/safety, read) without moving money outside
 * RePal's mandate. Deliberately excludes orders.create / orders.capture /
 * payments.createRefund.
 */
const SAFE_ACTIONS = {
  orders: { get: true }, // order status lookups
  shipment: { create: true, show: true, cancel: true }, // post-purchase tracking
  disputes: { list: true, get: true }, // trust & safety
  transactions: { list: true }, // reporting (read)
  invoices: { list: true, get: true }, // read
  subscriptionPlans: { list: true, show: true }, // read
} as const;

/** A lifted toolkit tool, as exposed by the bundled ai@4 `tool()`. */
interface RawToolkitTool {
  description: string;
  /** Zod schema from the toolkit's ai@4 `tool({ parameters })`. */
  parameters: z.ZodTypeAny;
  execute: (args: unknown) => Promise<unknown>;
}

/** Build the toolkit, or null if PayPal creds aren't configured. */
function buildToolkit(): PayPalAgentToolkit | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: SAFE_ACTIONS,
      context: { sandbox: (process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "LIVE" },
    },
  });
}

/**
 * Lift the toolkit's ai@4 tools into ai@7 tools. Exported for unit testing so
 * the shim can be verified without PayPal creds (pass the raw tools in).
 */
export function liftToolkitTools(raw: Record<string, RawToolkitTool>): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const [name, t] of Object.entries(raw)) {
    out[name] = tool({
      description: t.description,
      inputSchema: t.parameters,
      execute: async (args) => t.execute(args),
    });
  }
  return out;
}

/**
 * The PayPal Agent Toolkit tools to merge into the orchestrator, keyed by name.
 * Empty when the flag is off or creds are missing — a safe no-op.
 */
export function paypalToolkitTools(): Record<string, Tool> {
  if (!isPayPalToolkitEnabled()) return {};
  const tk = buildToolkit();
  if (!tk) return {};
  const raw = tk.getTools() as unknown as Record<string, RawToolkitTool>;
  return liftToolkitTools(raw);
}
