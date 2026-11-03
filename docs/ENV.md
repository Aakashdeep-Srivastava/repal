# Environment & secrets — team workflow

We're multiple people on one codebase. This is how env vars are organized so
nobody is blocked and no secret ever hits git.

## Two files, two purposes (both git-ignored)

| File | Holds | Who provides it | Read by |
| --- | --- | --- | --- |
| **`.env`** | **SHARED** — DB URLs, PayPal sandbox, Channel3, receipt signing key, FX/flags | One person generates/collects; shared via the **private team channel** | Prisma CLI **and** Next.js |
| **`.env.local`** | **PERSONAL** — your own model API key | You create your own | Next.js only (overrides `.env`) |

Why two: Prisma's CLI only reads `.env`, so the database URLs must live there.
Next.js reads `.env` then `.env.local` (local wins), so personal keys go in
`.env.local` and override the shared file when needed.

`.env.example` (committed) documents every variable with placeholders.

## Getting set up (new teammate)

```bash
git clone <repo> && cd repal
npm install

# 1. SHARED: get the filled .env from the team channel, drop it in the repo root.
#    (Do NOT reconstruct it from scratch — the receipt key must match everyone else's.)

# 2. PERSONAL: your own model key.
cp .env.example .env.local        # then keep only ANTHROPIC_API_KEY and fill it

npm run prisma:generate
npm run dev
```

## Where each value comes from

| Variable | Source |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Neon dashboard → project "RePal" → Connect (pooled + direct) |
| `PAYPAL_CLIENT_ID` / `_SECRET` | developer.paypal.com → Apps & Credentials → Sandbox app |
| `PAYPAL_WEBHOOK_ID` | Created after the deployed webhook URL exists (post-Render) |
| `CHANNEL3_API_KEY` | trychannel3.com/dashboard → API key |
| `RECEIPT_SIGNING_KEY` | **We generate it** (Ed25519, base64) — see `.env.example` one-liner. Shared, must match everyone. |
| `ANTHROPIC_API_KEY` | Your own Anthropic account (personal) |

## Rules

- **Never commit** `.env` or `.env.local` (git-ignored; CI/review enforce it).
- **Never paste** real secrets in PRs, issues, chat, or screenshots.
- Share the `.env` file over the **private team channel** only.
- Rotate a key if it's ever exposed; update `.env` everywhere + Render.

## Deploy (Render)

The deployed app does **not** use these files. The same variables go into
Render's **env group** (dashboard), per `docs/TECH_PRD.md` §14 — `DATABASE_URL`
is injected from the Render/Neon database, the rest are set once.

## Database isolation (optional upgrade)

Everyone currently shares one Neon dev database. If two people's data start
colliding (e.g. re-seeding), Neon supports **a branch per developer** (isolated
data, same schema) — each dev points `DATABASE_URL` at their own branch. Not
needed yet; noted here if we want it.
