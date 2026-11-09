# RePal — rewards to money, on PayPal

**RePal** = **Re**wards + Pay**Pal**. An agentic rewards-to-money layer: you
state a goal in plain language; the AI reads your rewards' fine print, a
**deterministic** optimizer finds the cheapest SKU *after* your rewards, and
**PayPal moves the money across the whole lifecycle** — identity, delegated
authority (Vault), pay-in (Orders), pay-out (Payouts, which liberates stuck
rewards into real cash), and reversal (Refunds).

> **Litmus test:** remove PayPal and the agent cannot act, get paid, or pay you
> back. The mandate *is* a PayPal Vault token; cashback settles via PayPal
> Payouts.

**Non-negotiable:** the **LLM never computes money.** The optimizer and policy
engine are deterministic and unit-tested; the LLM only reads, plans, explains,
and asks. Every PayPal call passes a signed policy gate first.

Built for the **PayPal AI Hackathon** (Devpost).

**▶ Live:** https://d14t147d5f4q6i.cloudfront.net — click **Judge demo** for a
one-click, self-contained account (no PayPal/Gmail of your own needed).

---

## What works end-to-end

- **Delegated authority** — a spending **mandate** is a real PayPal **Vault**
  token + signed policy (cap, budget, allow-list, approval threshold). Created
  through `/mandate`, Ed25519-signed, tamper-checked on every use.
- **Agentic shopping** — "noise-cancelling headphones under $250" → the agent
  reads applicable rewards, the deterministic optimizer ranks offers *after*
  rewards, and the policy gate returns **allow / ask / deny**.
- **Pay-in** — approved plans charge the Vault token via **Orders v2**
  (create → capture), producing a signed, verifiable **receipt** (`/verify/:id`).
- **Reward → cash** — `/rescue` + "cash out" liberate a stuck reward to your
  balance via **Payouts**, bounded to the reward's value, with a signed receipt.
- **Reversal** — **Refunds** persist and **webhooks act on events**
  (capture/refund/payout status) idempotently.
- **Insights** — `/insights` shows spend, savings-after-rewards, cashback
  liberated, and a searchable receipt grid, all from your own signed data.

## Sponsor integrations

| Sponsor | Where | What |
| --- | --- | --- |
| **PayPal Agent Toolkit** | `scripts/paypal-mcp.ts` · [`docs/MCP.md`](docs/MCP.md) | An **MCP server** (`@paypal/agent-toolkit/mcp`) exposing PayPal rails to any MCP client. `npm run paypal:mcp`. |
| **AG Grid** | `/insights` | Sortable/filterable/searchable transaction grid (v36 Theming API, theme-aware), mirroring the official PayPal × AG Grid boilerplate. |
| **Bryntum** | `/rescue` | A **Scheduler** timeline plotting every reward against its expiry (🔴 ≤7d / 🟠 ≤30d) so you rescue value before it vanishes. |

## Architecture

- **Next.js 15** (App Router, standalone) · **Prisma + Neon Postgres** ·
  **AI SDK 7**.
- **AI is provider-switchable** (`AI_PROVIDER = bedrock | anthropic | openai`).
  Default **AWS Bedrock Claude Haiku 4.5**; the app runs deterministic flows
  with no AI at all (the agent box is the only AI-gated surface).
- **Deterministic core** (`lib/`) — optimizer, policy engine, Ed25519
  receipt/mandate signing — unit-tested (127 tests).
- **Deployed on AWS:** ECS Fargate + ALB + CloudFront, image via ECR, secrets in
  Secrets Manager, keyless GitHub-Actions OIDC CI/CD, CloudWatch alarms +
  Discord notifications. See [`docs/DEPLOY_AWS.md`](docs/DEPLOY_AWS.md).

## Quick start

```bash
cp .env.example .env.local        # fill sandbox keys (see .env.example)
npm install
npm run prisma:generate
npm run dev                       # http://localhost:3000
npm test                          # deterministic core (127 tests)
```

`DATABASE_URL` points at Postgres (a Neon pooled URL works). Seed a demo wallet
with `npm run seed`.

## Repo map

| Path | What |
| --- | --- |
| `app/` | Next.js 15 App Router — UI + API routes |
| `agents/` | AI SDK orchestration — tools, prompts (money-forbidden) |
| `lib/` | **Deterministic core** — optimizer, policy, receipts, tnc, paypal adapter, fx |
| `components/` | UI incl. `rescue/` (Bryntum), `insights/` (AG Grid), `mandate/`, `wallet/` |
| `scripts/` | `paypal-mcp.ts` (MCP server), smoke tests, seeds |
| `prisma/` | Schema, migrations, seed |
| `workers/` | Reward ingestion + expiry scan |
| `evals/` | T&C golden eval (run in CI) |
| `docs/` | `TECH_PRD.md`, `DEPLOY_AWS.md`, `MCP.md`, `TEAM.md` |

## Docs

- **Full spec:** [`docs/TECH_PRD.md`](docs/TECH_PRD.md)
- **Deploy (AWS):** [`docs/DEPLOY_AWS.md`](docs/DEPLOY_AWS.md)
- **MCP server:** [`docs/MCP.md`](docs/MCP.md)
- **Ownership:** [`docs/TEAM.md`](docs/TEAM.md) · **How we work:** [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

[MIT](LICENSE)
