# RePal — Devpost submission

**Live:** https://d14t147d5f4q6i.cloudfront.net (click **Judge demo**)
**Repo:** https://github.com/Aakashdeep-Srivastava/repal

## Elevator pitch

RePal turns the rewards you already have — gift cards, cashback, points, coupons
— into money you can actually spend or cash out, with an AI agent that reads the
fine print and PayPal moving every dollar. The LLM never computes an amount:
all math is deterministic and gated.

## Inspiration

Everyone is sitting on rewards that quietly expire — a $50 gift card here, 3,000
points there — because the terms are a maze and the value is trapped in a dozen
walled gardens. We wanted an agent that (a) understands those terms, (b) finds
the genuinely cheapest price *after* rewards, and (c) can move real money to act
on it. PayPal is the one platform that closes that whole loop: identity,
delegated authority, pay-in, **pay-out**, and reversal.

## What it does

- **Reads your rewards' fine print** (Terms agent) and extracts structured rules.
- **Finds the cheapest SKU after rewards** with a deterministic optimizer.
- **Enforces a signed spending mandate** — a real PayPal **Vault** token plus a
  policy (cap, budget, allow-list, approval threshold). Every purchase is gated
  **allow / ask / deny** *before* approval and *again* before capture.
- **Pays in** via PayPal Orders v2 against the Vault token, issuing a signed,
  publicly **verifiable receipt**.
- **Liberates stuck rewards into cash** via PayPal **Payouts** (the `/rescue`
  timeline shows what's about to expire).
- **Handles reversals** — Refunds persist and webhooks update status idempotently.
- **Shows the money** — an `/insights` dashboard (AG Grid) of spend,
  savings-after-rewards, and cashback liberated, all from signed data.

## The one rule: the LLM never computes money

Amounts come only from the deterministic optimizer or the database. Every agent
tool delegates to a unit-tested `lib/` function; the policy gate re-checks the
plan against the signed mandate before any PayPal call. Mandates and receipts
are **Ed25519-signed** and tamper-verified. This is what makes an *agentic*
money app trustworthy.

## How we built it

- **Next.js 15** (App Router) + **Prisma/Neon Postgres** + **AI SDK 7**.
- **AI is provider-switchable** — `AI_PROVIDER = bedrock | anthropic | openai`;
  default **AWS Bedrock Claude Haiku 4.5**. The deterministic flows need no AI.
- **PayPal** — Orders v2, Vault v3, Payouts, Refunds, Webhooks, OIDC login.
- **Deployed on AWS** — ECS Fargate + ALB + CloudFront, ECR images, Secrets
  Manager, **keyless GitHub-Actions OIDC** CI/CD, CloudWatch alarms + Discord.

### Sponsor tech

- **PayPal Agent Toolkit** — an **MCP server** (`@paypal/agent-toolkit/mcp`)
  exposes PayPal rails to any MCP client (`npm run paypal:mcp`).
- **AG Grid** — the `/insights` transaction grid (v36 Theming API).
- **Bryntum** — the `/rescue` reward-expiry Scheduler timeline.

## Challenges we ran into

- **Keeping the LLM away from arithmetic** while still feeling agentic — solved
  with a strict tool boundary + deterministic gate.
- **Making a mandate real** — wiring the PayPal Vault setup-token → payment-token
  dance and binding the signature to the vault token + user.
- **Sponsor version clashes** — the PayPal Agent Toolkit pins `ai@4` but we run
  `ai@7`, so we integrated it via its framework-independent **MCP** surface
  instead of the ai-sdk adapter.
- **SSR vs. heavy client libs** — Bryntum crashes under SSR, so it loads
  browser-only with its license registered *before* the module initializes.

## Accomplishments we're proud of

- A genuinely end-to-end money loop on PayPal — in, out, and back — behind a
  signed policy gate, with 127 passing deterministic tests.
- One-click **Judge demo** so anyone can exercise the full flow with zero setup.
- Three real sponsor integrations, each shipped behind a flag and verified live.

## What's next

- Real Gmail ingestion (consent-first, read-only, reward-emails-only).
- US-account Payouts for the cash-out leg end-to-end in the demo region.
- AG Studio enterprise insights (grouping + integrated charts).

## Built with

Next.js, TypeScript, Prisma, Neon, AI SDK, AWS Bedrock (Claude Haiku), PayPal
(Orders/Vault/Payouts/Refunds/Webhooks/OIDC), PayPal Agent Toolkit (MCP), AG
Grid, Bryntum, AWS (ECS Fargate, ALB, CloudFront, ECR, Secrets Manager,
CloudWatch), GitHub Actions (OIDC).

## Honesty note

Seeded wallet entries are clearly labelled **sample data**. Monetary amounts in
the demo are PayPal **sandbox**. Nothing on camera is faked — receipts and
mandates are really signed and verifiable at `/verify/:id`.
