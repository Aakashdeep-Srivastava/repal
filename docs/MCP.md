# RePal × PayPal — MCP server

RePal exposes PayPal's rails as an **MCP server** built on the official
[**PayPal Agent Toolkit**](https://www.npmjs.com/package/@paypal/agent-toolkit)
(`@paypal/agent-toolkit/mcp`). Any MCP client — Claude Desktop, Cursor, the MCP
Inspector — can connect and drive PayPal operations (create/get orders, list
transactions, invoices, products, subscription plans, disputes) against RePal's
sandbox account.

> **Why MCP, not the toolkit's `ai-sdk` adapter:** the toolkit pins `ai@4` while
> RePal's app runs `ai@7`, so the ai-sdk tools are version-incompatible. The MCP
> surface is framework-independent, so it composes cleanly and keeps RePal's app
> on the latest AI SDK.

## Run it

```bash
npm run paypal:mcp
```

Reads `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENVIRONMENT` from
`.env.local` (sandbox by default), mints an OAuth token, and serves the MCP
protocol over **stdio**. It prints only to stderr — stdout is the MCP transport.

## Connect from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "repal-paypal": {
      "command": "npx",
      "args": ["tsx", "scripts/paypal-mcp.ts"],
      "cwd": "/absolute/path/to/repal"
    }
  }
}
```

Then ask: *"List my recent PayPal transactions"* or *"Create a $50 order."*

## Enabled actions

A read-biased default set lives in `scripts/paypal-mcp.ts` (`ACTIONS`):
`orders{create,get}`, `invoices{create,list,get}`, `transactions{list}`,
`products{list}`, `subscriptionPlans{list}`, `disputes{list,get}`. Widen it
deliberately per flow.

## How this fits RePal's safety model

This server is the **raw PayPal toolkit surface** — useful for exploration and
the sponsor integration. RePal's *own* agent never calls it directly: in-app,
every money movement goes through the deterministic policy gate
(`lib/policy/`), and **the LLM never computes an amount** — see
[TECH_PRD.md](./TECH_PRD.md). The MCP server is an additional, optional access
path, not a bypass of the gate.
