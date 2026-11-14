# RePal — Agentic Commerce: Comparison & Commercial Feasibility

_How RePal fits the agentic-commerce landscape, how it integrates PayPal's official
Agent Toolkit, and whether it works as a business — with the **PayPal sandbox at the
center**._

_Last updated: 2026-11-14 · Companion to `docs/PAYPAL_SANDBOX.md`._

---

## 1. Where RePal sits

RePal is an **agentic-commerce** app whose entire money spine is the **PayPal sandbox**
(see `docs/PAYPAL_SANDBOX.md` for the full API reference). The agent reads your rewards,
finds the cheapest price *after* them, and settles with PayPal — within a
cryptographically-signed, revocable spending mandate. Its distinctive stance:

> **The LLM never computes money, and money never moves outside a signed mandate.**
> Prices/discounts/budgets come from a deterministic pipeline; every spend is re-checked
> by a server-side policy gate before a cent moves.

That stance is what makes RePal *safe* to hand real payment authority — the core problem
every agentic-commerce standard is trying to solve.

---

## 2. The agentic-commerce landscape

Four things are converging. RePal already touches all of them — and the official toolkit
is now wired in.

| Approach | What it is | RePal's relationship |
|---|---|---|
| **PayPal Agent Toolkit** (`@paypal/agent-toolkit`) | PayPal's official tools (orders, invoices, subscriptions, shipment tracking, disputes, reporting) for AI SDK / MCP / LangChain / CrewAI / Bedrock / OpenAI | ✅ **Wired** (post-purchase + read tools) via an adapter — §3 |
| **PayPal MCP** (`@paypal/mcp`, `mcp.sandbox.paypal.com`) | A remote/local MCP server exposing the same tools to any MCP client | ↔️ Same tool surface; adapter path chosen over MCP to stay in-process (§3.4) |
| **AP2** — Google Agent Payments Protocol | Chains 3 signed mandates (Intent → Cart → Payment) as W3C Verifiable Credentials; PayPal is the most public partner | 🧭 RePal already signs mandates/plans/receipts (Ed25519) — one adapter from AP2 (§4) |
| **ACP** — OpenAI Agentic Commerce Protocol | Checkout *inside* an assistant (e.g. ChatGPT); PayPal adopted it Oct 2025 | 🔭 Stretch: expose RePal checkout as an ACP surface (§4) |
| **RePal's deterministic mandate gate** | Signed policy + server-side re-gate + "LLM never computes money" | 🟢 The differentiator — the *enforcement* layer the protocols assume but don't provide |

**Key insight:** the protocols standardize *how an agent expresses authority and a cart*.
They do **not** give you a deterministic, tamper-evident **enforcement** engine. RePal's
`lib/policy` gate + Ed25519 mandates *are* that engine — so RePal is complementary to (not
replaced by) AP2/ACP/the toolkit.

---

## 3. Integrating the PayPal Agent Toolkit — the engineering reality

### 3.1 The version clash (why a naïve integration fails)
`@paypal/agent-toolkit@1.11` bundles its **own `ai@4`** as a direct dependency and builds
tools with v4's `tool({ parameters, execute })`. RePal runs **`ai@7`**, whose `tool()` uses
`inputSchema`. **Spreading `toolkit.getTools()` straight into a v7 agent is unsafe** — the
v4 tool shape isn't understood by the v7 runtime. This is a real, reproducible trap (and a
common reason teams abandon the toolkit mid-integration).

### 3.2 The adapter (`lib/paypal/toolkit.ts`)
Both packages resolve the **same top-level `zod@3.25`**, so each toolkit tool exposes a
`{ description, parameters (zod), execute }` we can losslessly lift:

```ts
tool({ description: t.description, inputSchema: t.parameters, execute: (a) => t.execute(a) })
```

`execute` is version-agnostic (it only calls PayPal REST), so the lift is clean. The two
`ai` copies coexist in the bundle (verified: `next build` passes).

### 3.3 Safety — money stays on the gated path
The adapter exposes **only post-purchase / read** tools (`get_order`,
`create_shipment_tracking`, `get_shipment_tracking`, `list_disputes`, `get_dispute`,
`list_transactions`, invoice/plan reads). The money-movers (`create_order`, `pay_order`,
`create_refund`) are **deliberately excluded** — verified: **0 money-movers exposed**. All
spending still flows through RePal's deterministic, mandate-gated `pay`/`payout`. The
toolkit tools merge in *before* RePal's tools, so a gated tool always wins a name clash.

### 3.4 Enabling it
Feature-flagged, **off by default** (additive — nothing that works changes until you opt in):

```bash
PAYPAL_AGENT_TOOLKIT=1   # + PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET already set
```

The orchestrator's system prompt then instructs the agent to use the toolkit for
post-purchase/read tasks only. To instead use PayPal's **MCP** server, point an MCP client
at `mcp.sandbox.paypal.com` with `PAYPAL_ACCESS_TOKEN` + `PAYPAL_ENVIRONMENT=SANDBOX` — the
in-process adapter was chosen here to avoid a second network hop and keep `gateSpend` in the
same process as the tools.

---

## 4. Protocol roadmap (the "what's next")

**AP2 mandate mapping (highest-leverage, low effort):** RePal already has the exact
cryptographic primitives AP2 standardizes.

| AP2 mandate (W3C VC) | RePal artifact today | Adapter work |
|---|---|---|
| **Intent Mandate** (budget/categories/timing) | Ed25519 signed spending mandate (`lib/policy/mandate`) | serialize mandate → VC |
| **Cart Mandate** (specific cart at a price) | optimizer's signed plan + confirm-to-pay | serialize plan → VC |
| **Payment Mandate** (credential on the auth) | signed receipt / order metadata | attach to the order |

Shipping a VC serializer reframes RePal's existing trust model as a **standards-compliant
AP2 implementation** — a genuine, defensible "new payment experience."

**ACP (stretch):** expose the checkout as an ACP surface so the agent can transact from
within an assistant. The 2026 minimum-viable protocol set is **ACP + AP2 + TAP**.

---

## 5. Commercial feasibility

### 5.1 The problem & market
- **Breakage is massive:** billions in gift-card and loyalty value expire unused every year.
  RePal's **reward→cash liberation** (PayPal Payouts) turns stuck value into real money, and
  its optimizer finds the true cheapest price *after* rewards.
- **Agentic commerce is the wave:** every major network (PayPal, Google, OpenAI, Mastercard)
  is racing to let agents transact. The missing piece is **safe delegated authority** — which
  is RePal's core.

### 5.2 Business model & unit economics
RePal never holds funds (PayPal moves the money), which keeps it **out of money-transmitter
territory** — a decisive regulatory advantage. Revenue stacks:

| Stream | Mechanism |
|---|---|
| **Affiliate commission** | Channel3 offers carry `maxCommissionRate`; RePal earns on the purchase it routes |
| **PayPal volume** | drives Orders / Pay Later / Venmo / Payouts — aligns with a PayPal partnership |
| **Optional take-rate** | a small fee on *liberated* reward value (or keep free, monetize on affiliate) |
| **B2B / white-label** | the mandate-gated spend engine licensed to other agent builders |

**Per-run cost is low:** the Gemini-first failover chain runs most agent turns at
≈$0.001–0.01, and the step cap (10) bounds worst-case LLM spend; the deterministic pipeline
(optimizer/policy) is effectively free. Net contribution per routed purchase is **positive**
on affiliate alone.

### 5.3 Cost to run (today's stack)
- **AI:** multi-provider failover (Gemini free tier → Groq/OpenRouter → Bedrock), so cost is
  near-zero at demo scale and elastic under load.
- **PayPal:** sandbox is free; production uses standard Orders/Payouts fees (pass-through).
- **Infra:** ECS Fargate + ALB + CloudFront + Neon (pooled Postgres) — a few $ /day idle,
  scales horizontally (stateless app, signed-cookie sessions, no server session store).

### 5.4 Scaling & productionization
- **Scales horizontally** — stateless Next.js, pooled Neon, CDN. The money path is I/O-bound
  on PayPal, not CPU.
- **Idempotency** — `PayPal-Request-Id` on every mutating call; add a dedupe key on
  `Receipt`/`Payout` for retry safety (tracked in `docs/PAYPAL_SANDBOX.md` §7).
- **Observability** — Discord alerting + CloudWatch alarms already wired.

### 5.5 Risks & mitigations
| Risk | Mitigation |
|---|---|
| **Money-transmission regulation** | never custody funds — PayPal rails only |
| **Agent over-spends / wrong purchase** | signed mandate + server-side re-gate + approval threshold (human-in-the-loop) |
| **Prompt injection moves money** | LLM never computes amounts; gate re-checks the real mandate; money-mover toolkit tools excluded |
| **Sandbox→prod gaps** | US business account (real Payouts), OIDC `state` verification, holds/auth-capture |
| **Protocol churn (AP2/ACP)** | thin adapter layer; core enforcement engine is protocol-agnostic |

---

## 6. What to change for production (prioritized)
1. **Authorization + Capture (holds) + partial captures** — correct agentic pattern; unlocks
   reserve-on-intent / capture-on-fulfillment (`docs/PAYPAL_SANDBOX.md` §7.1).
2. **US sandbox/live business account** — real Payouts + Vault (removes the simulated path).
3. **Verify OIDC `state`** (CSRF) + **idempotent money writes** (receipt/payout dedupe).
4. **Ship the AP2 VC serializer** (§4) — the standards story that wins "what's next."
5. **Session-gate the order/capture routes** for production (keep a demo switch).

---

## References
- PayPal Agent Toolkit quickstart — `developer.paypal.com/ai-tools/toolkit` · repo `github.com/paypal/agent-toolkit`
- PayPal MCP — https://developer.paypal.com/community/blog/paypal-model-context-protocol/
- PayPal × AP2 — https://developer.paypal.com/community/blog/PayPal-Agent-Payments-Protocol/
- AP2 explained — https://eco.com/support/en/articles/14845479-ap2-agent-payments-protocol-explained
