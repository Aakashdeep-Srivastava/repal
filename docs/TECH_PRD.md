# RePal — Technical PRD (v3, PayPal-central)

> **RePal** = **Re**wards + Pay**Pal** — a fintech rewards agent built on PayPal.

**One line:** An agentic rewards-to-money layer. You state a goal in plain language; the AI reads your rewards' fine print, a deterministic optimizer finds the cheapest SKU **after** your rewards, and **PayPal moves the money across the whole lifecycle** — identity, delegated authority (Vault), pay-in (Orders), pay-out (Payouts, which liberates stuck rewards into real cash), and reversal (Refunds).

**Litmus test (why PayPal is central, not a checkout button):** remove PayPal and the agent cannot act, get paid, or pay you back. The mandate *is* a PayPal Vault token; cashback is settled with PayPal Payouts; agent-to-agent settlement rides PayPal.

- **Event:** PayPal AI Hackathon (Devpost) · deadline **Nov 12, 2026, 12:00 PT (Nov 13, 01:30 IST)** · judging Dec 1–15.
- **Prize targets:** Overall top-3 · Best Use of PayPal + AI · Best Use of Agentic Commerce · Best Demo Delivery · Best Use of Channel3 · Best Use of AG Grid · Best Use of APIMatic · Render.
- **Persona:** US-first (Maya, USD); India cross-border (buy from a US store, settle USD) as a second path.
- **Non-negotiable:** the LLM never computes money. The optimizer and policy engine are deterministic and unit-tested; the LLM only reads, plans, explains, and asks.

---

## 1. Scope

| Priority | Feature |
| --- | --- |
| Must | Log in with PayPal (OIDC) → grant a **Vault-backed mandate** (cap, budget, allow-list, approval threshold) |
| Must | Conversational intent → structured purchase intent |
| Must | **Auto-ingested** reward wallet (≥17 rewards) — no manual entry; each with its own free-text T&Cs |
| Must | Terms agent: T&Cs → typed rules + confidence + quoted clause; number-grounding guard |
| Must | Channel3 discovery → optimizer joint-optimizes **SKU × reward stack** → 3 plans with rejection reasons |
| Must | Policy engine (Intent + Cart mandate) → `allow` / `ask` / `deny`; checked before approval and before capture |
| Must | PayPal pay-in: Orders v2 create → capture (buyer-present JS SDK v6 **and** agent-initiated via vault, no redirect) |
| Must | **PayPal Payouts — reward liberation:** cash out unused/expiring reward value to the user's PayPal balance |
| Must | Signed decision receipt (SHA-256 + Ed25519) + public `/verify/:id`; signature-verified webhooks |
| Must | AG Studio insights dashboard with a **custom agent** over receipts + PayPal Transaction Search |
| Should | A2A settlement beat (merchant/issuer agent settles over PayPal) |
| Should | Cognee preference memory ("keep points for travel"); Bryntum rescue timeline; Render cron re-scan |
| Won't | Real-money PayPal, real fulfilment, PYUSD, live partner balances (all sandbox + labelled) |

---

## 2. Request lifecycle (the 9-step flow)

1. **Login + mandate** — OIDC login; `POST /v3/vault/setup-tokens` → approve → `/v3/vault/payment-tokens`. Store the token as the agent's scoped authority.
2. **Orchestrator** — AI SDK 6 `ToolLoopAgent` parses intent, drives tools.
3. **Discover** — Channel3 `find_offers` → real SKUs across retailers.
4. **Optimize** — deterministic branch-and-bound over SKU × stackable rewards → 3 plans + per-reward rejection (with clause).
5. **Policy gate** — Intent + Cart mandate check → `allow` / `ask` / `deny`.
6. **Pay-in** — Orders v2 capture (vault token, no redirect; or JS SDK v6 button first time).
7. **Pay-out** — Payouts liberates leftover/expiring reward value to the user's PayPal balance.
8. **Receipt** — canonical JSON → SHA-256 → Ed25519; webhook-driven state.
9. **Insights** — AG Studio dashboard + dashboard agent over receipts + Transaction Search.

---

## 3. Agents & tools

| ID | Unit | Kind | Built with | Touches |
| --- | --- | --- | --- | --- |
| A0 | Orchestrator | LLM | AI SDK 6 `ToolLoopAgent`, temp 0 | all tools + PayPal Toolkit/MCP |
| A1 | Intent agent | LLM (structured) | `generateObject` + Zod | `render_intent` |
| A2 | Terms agent | LLM (structured), worker | `generateObject`, grounding guard | ingestion, wallet |
| A3 | Discovery | Tool | Channel3 REST | Channel3 |
| A4 | Optimizer | **Deterministic** | TS branch-and-bound | — |
| A5 | Explainer | LLM (grounded) | post-check vs optimizer JSON | plan/rejection cards |
| A6 | Policy engine | **Deterministic** | TS, mandate checks | approval gate |
| A7 | Payment agent | Tools | Agent Toolkit + REST (Vault, Orders, Payouts, Refunds) | **PayPal** |
| A8 | Receipt agent | **Deterministic** | SHA-256 + Ed25519 | Postgres, verify |
| A9 | Rescue agent | Cron + tool | Render cron | Bryntum |
| A10 | Dashboard agent | LLM | AG Studio Agent Framework | AG Studio, Transaction Search |
| M | Memory | LLM/graph | Cognee (optional) | preference graph |

Tool-call order: `render_intent → scan_wallet → parse_terms → find_offers → optimize → explain → check_policy → [request_approval] → pay → payout → issue_receipt`. Every tool call is persisted to `tool_traces` and streamed to the UI via SSE.

---

## 4. PayPal integration (the money lifecycle)

Sandbox base `https://api-m.sandbox.paypal.com`. README carries this table verbatim (evidence for Best Use of PayPal + AI).

| Stage | Capability | Call |
| --- | --- | --- |
| Identity | Log in with PayPal (OIDC) | authorize → `POST /v1/oauth2/token` → `GET /v1/identity/openidconnect/userinfo` |
| Authority | Vault v3 setup + payment token | `POST /v3/vault/setup-tokens` → approve → `POST /v3/vault/payment-tokens` |
| Pay-in | Orders v2 (buyer-present) | toolkit `create_order` → JS SDK v6 `createPayPalOneTimePaymentSession` → `pay_order` |
| Pay-in | Orders v2 (agent-initiated) | `create_order` with `payment_source.paypal.vault_id` → `pay_order` (no redirect) |
| **Funding choice** | Agent-selected funding (`lib/paypal/funding`) | deterministic `selectFunding(amount)` → Orders `payment_source`: `venmo` (Venmo wallet) or `paypal` (balance / **Pay Later** when eligible); one-tap override; falls back to `paypal` if a funding method fails |
| **Pay-out** | **Payouts — reward liberation** | `POST /v1/payments/payouts` → user's sandbox personal balance. IN sandbox sender is restricted → **honest simulated payout** (real signed receipt, no money moved) |
| Reversal | Refunds | `create_refund` → `POST /v2/payments/captures/{id}/refund` |
| Feedback | Webhooks (signature-verified) | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.PAYOUTSBATCH.SUCCESS`, refund events; verify via `/v1/notifications/verify-webhook-signature` |
| Insights | **Transaction Search (live)** | `GET /v1/reporting/transactions` → settled-txn history on `/insights` (session-gated; RePal's own account) |
| Insights | **Balances (live)** | `GET /v1/reporting/balances` → account balance KPI on `/insights` |
| Hands | Agent Toolkit / MCP | `@paypal/agent-toolkit/ai-sdk`; `@ai-sdk/mcp` → `mcp.sandbox.paypal.com` |

Currency: INR is not a PayPal REST currency → settle **USD**, display ₹ on cross-border with a pinned FX and an honest note. Idempotency: `PayPal-Request-Id` on every create/capture/refund/payout.

---

## 5. Sponsor & dev-skills integration

| Tool | Use | Prize |
| --- | --- | --- |
| **Channel3** | `find_offers` → "cheapest after rewards"; a $40 Best Buy cert flips the winner vs a lower Amazon sticker | Best Use of Channel3 |
| **AG Studio** | Insights dashboard: custom widgets + dashboard agent over receipts + Transaction Search | Best Use of AG Grid |
| **Bryntum** | Rescue timeline (expiry bars, agent-booked rescue events, drag → re-optimize) | Best Use of Bryntum |
| **Render** | `render.yaml`: web + worker + cron + Postgres; webhook URL; Deploy button | Best Use of Render |
| **Postman** | Public workspace: mandate → pay → payout → verify, with tests | — (judge convenience) |
| **APIMatic + PayPal AI Toolkit** | **Dev skills:** `npx context-plugins install …server-sdk-plugin-hackathon`; PayPal AI Toolkit `/paypal:setup`, `/paypal:doctor`, `paypal-best-practices` → correct PayPal SDK code; log prompts/diffs in `docs/skills.md` | Best Use of APIMatic |
| Skipped | Elastic, KERNEL, Zapier, Astropods (logo-only would hurt credibility) | — |

---

## 6. Data model (Prisma)

See `prisma/schema.prisma` (kept in sync with this section): `User`, `Mandate`, `Reward`, `Offer`, `AgentRun`, `Plan`, `Receipt`, `ToolTrace`, `WebhookEvent`.

---

## 7. RePal API routes

| Route | Purpose |
| --- | --- |
| `POST /api/auth/paypal/callback` | OIDC code exchange, session |
| `POST /api/mandates` · `DELETE /api/mandates/:id` | create (setup→payment token) / revoke |
| `POST /api/runs` · `GET /api/runs/:id/stream` (SSE) | start agent run; stream tool parts + trace |
| `POST /api/runs/:id/approve` · `/decline` | answer `request_approval` |
| `POST /api/pay/order` · `POST /api/pay/capture` · `POST /api/pay/payout` · `POST /api/pay/refund` | PayPal money ops |
| `POST /api/webhooks/paypal` | signature-verified webhook sink |
| `GET /api/receipts/:id` · `GET /verify/:id` | receipt JSON / public verifier |
| `POST /api/wallet/import` · `POST /api/wallet/ingest/email` | seed / connect-source ingestion |
| `GET /api/offers?q=` | Channel3 proxy (cached) |
| `GET /api/transactions` | PayPal Transaction Search proxy (for AG Studio) |
| `POST /api/agent/widget` | AG Studio dashboard-agent entry |

---

## 8. Folder structure

Single Next.js 15 (App Router) app with a clean `lib/` core. Deterministic money
logic lives in `lib/` and is unit-tested in isolation. (Full tree in the repo;
this scaffold follows it.)

---

## 9. Stack & environment

**Stack:** Next.js 15 (App Router, TS), Tailwind + shadcn/ui, AI SDK 6 (`useChat` typed tool parts), `@paypal/agent-toolkit/ai-sdk`, `@ai-sdk/mcp`, PayPal Server SDK (Vault/Payouts/webhooks), `@paypal/paypal-js/sdk-v6`, AG Studio React, Bryntum Scheduler, Prisma + Postgres, Zod, Cognee (optional). Model: Claude Sonnet 4.5 or GPT-4.1 (swappable), temperature 0.

**`.env.example`:** see repo root — `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT=SANDBOX`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_OIDC_REDIRECT`, `CHANNEL3_API_KEY`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, `DATABASE_URL`, `RECEIPT_SIGNING_KEY` (Ed25519, base64), `FX_INR_PER_USD=84`, `DEMO_MODE=true`.

---

## 10. Build plan to Nov 12 (17 build days + 2 for video)

1. **Nov 1–2 — Foundation.** Repo+MIT, Next.js + AI SDK pinned, Prisma+Postgres, PayPal sandbox app (Vault on), `create_order→pay_order` smoke test. Install PayPal AI Toolkit skill + APIMatic plugin.
2. **Nov 3–4 — Generative UI + home/agent shell + mandate (Vault).**
3. **Nov 5–6 — Terms agent + grounding guard + 20-item eval; ingestion worker.**
4. **Nov 7 — Optimizer (SKU×reward) + 3 plans + Channel3 `find_offers`.**
5. **Nov 8 — Policy engine + approval gate; Orders both flows + webhooks.**
6. **Nov 9 — Payouts (reward liberation) + receipts + `/verify` + refunds.**
7. **Nov 10 — AG Studio dashboard + dashboard agent; Bryntum rescue.**
8. **Nov 11 — Render deploy, Postman, A2A beat, polish.**
9. **Nov 11–12 — Record 2:50 video, README, judge credentials, submit.**

---

## 11. Demo script (<3 min)

**Video beats:** login+mandate (Vault) → "headphones under $250" → wallet auto-imported + one T&C parsed live → Channel3 offers → "cheapest after rewards" plan → approval → **capture (no redirect)** → signed receipt → **Payouts: expiring $50 reward cashed out to PayPal** → refused $650 attempt → Insights widget from a question. Close on the money-lifecycle line.

---

> §12 (design/frontend UI stack), §13 (pixel-perfect checklist), §14 (deployment
> & database), and §15 (data sources & ingestion) are carried in the original PRD
> handed to the team. Key operational decisions already applied to this repo:
> - Host = **Render** via `render.yaml` (web + worker + cron + Postgres). Use
>   **paid** web + Postgres (credits) so the DB survives to Dec 15 judging.
> - One responsive web app + light PWA. Tailwind v4 OKLCH tokens, shadcn/ui,
>   AI Elements for agent cards, Motion v14, ≤5 effect flourishes.
> - Rewards come from a **normalized schema + adapters + Terms Agent**, not 50
>   integrations. Real sources: Gmail, PayPal offers, Channel3; rest seeded &
>   labelled. Discovering a reward ≠ programmatically redeeming it — settlement
>   (pay-in + Payouts) is real PayPal sandbox; redemption is applied-as-discount.
