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

**Non-negotiable:** the LLM never computes money. The optimizer and policy
engine are deterministic and unit-tested; the LLM only reads, plans, explains,
and asks.

Built for the **PayPal AI Hackathon** (Devpost) · submission deadline **Nov 12, 2026**.

---

## Status

🚧 **Foundation (Nov 1–2).** Repo scaffolded: Next.js 15 + TS, Prisma schema,
deterministic `lib/` core (typed contracts stubbed), test harness, CI, Render
blueprint. Feature build in progress per `docs/TECH_PRD.md` §10.

## Quick start

```bash
cp .env.example .env.local        # fill sandbox keys (see .env.example)
npm install
npm run prisma:generate
npm run dev                       # http://localhost:3000
npm test                          # deterministic core
```

A local Postgres is expected at `DATABASE_URL` (see `docker-compose.yml` once added,
or use a Neon/Render pooled URL).

## Repo map

| Path | What |
| --- | --- |
| `app/` | Next.js 15 App Router — UI + API routes |
| `agents/` | AI SDK 6 orchestration — tools, prompts (money-forbidden) |
| `lib/` | **Deterministic core** — optimizer, policy, receipts, tnc, paypal adapter, fx |
| `prisma/` | Schema, migrations, seed (17 sample rewards) |
| `workers/` | Reward ingestion + nightly expiry scan |
| `evals/` | T&C golden eval (run in CI) |
| `docs/` | `TECH_PRD.md` (full spec), `TEAM.md` (ownership) |

## Team & ground rules

- **Who owns what:** [`docs/TEAM.md`](docs/TEAM.md)
- **How we work:** [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **Full spec:** [`docs/TECH_PRD.md`](docs/TECH_PRD.md)

## License

[MIT](LICENSE)
