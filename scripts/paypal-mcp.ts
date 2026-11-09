/**
 * RePal — PayPal MCP server (built on the PayPal Agent Toolkit).
 *
 *   npm run paypal:mcp
 *
 * Exposes PayPal sandbox operations as MCP tools over stdio, so any MCP client
 * (Claude Desktop, Cursor, the MCP Inspector) can drive RePal's PayPal rails —
 * create/get orders, list transactions, invoices, etc. Built directly on
 * `@paypal/agent-toolkit/mcp` (PayPalAgentToolkit extends the MCP SDK's
 * McpServer), configured with RePal's sandbox credentials.
 *
 * Why MCP and not the toolkit's ai-sdk adapter: the toolkit pins `ai@4` while
 * RePal's app runs `ai@7`, so its ai-sdk tools are version-incompatible — but
 * the MCP surface is framework-independent and composes cleanly.
 *
 * IMPORTANT: stdout is the MCP transport. Never write to stdout here — all logs
 * go to stderr.
 */
import "./_env";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAccessToken, PAYPAL_BASE } from "@/lib/paypal/client";

// Read-biased action set: discovery + order creation, no destructive ops by
// default. Widen deliberately when a flow needs it.
const ACTIONS = {
  orders: { create: true, get: true },
  invoices: { create: true, list: true, get: true },
  transactions: { list: true },
  products: { list: true },
  subscriptionPlans: { list: true },
  disputes: { list: true, get: true },
} as const;

async function main() {
  const sandbox = (process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "LIVE";
  const accessToken = await getAccessToken();

  const server = new PayPalAgentToolkit({
    accessToken,
    configuration: { actions: ACTIONS as never, context: { sandbox } },
  });

  await server.connect(new StdioServerTransport());
  console.error(`[paypal-mcp] connected on stdio · base=${PAYPAL_BASE} · sandbox=${sandbox}`);
}

main().catch((err) => {
  console.error("[paypal-mcp] fatal:", err);
  process.exit(1);
});
