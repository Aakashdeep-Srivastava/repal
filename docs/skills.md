# Dev skills & agent tooling

Per PRD §5 (Best Use of APIMatic / dev skills), we log the agent skills used to
produce correct SDK/integration code.

## Channel3 API skill

- **Installed:** `npx skills add channel3-ai/skills --skill channel3-api`
- **Lockfile:** `skills-lock.json` (committed — run `npx skills install` to materialize)
- **Materialized to:** `.agents/skills/channel3-api/` (git-ignored; restore via the lock)

**Used to build:**
- `lib/channel3.ts` — the discovery adapter. The skill documented the real
  `POST https://api.trychannel3.com/v1/search` contract: `x-api-key` auth, and
  the nested response shape (`product.offers[].price.price` + `.price.currency`,
  retailer as `offer.domain`, buy link as `offer.url`) — which differs from the
  simplified public docs and was the fix that made live results map correctly.
- `app/api/offers/route.ts` — cached proxy over the adapter.

**Verified live:** `GET /api/offers?q=headphones&max=250` → 10 real products
(Best Buy, JBL, Sennheiser, Soundcore, …), then served from cache on repeat.

## Reproduce locally

```bash
npx skills install      # reads skills-lock.json → restores .agents/.claude skills
```

The Channel3 API key is read from `CHANNEL3_API_KEY` (env only, never hardcoded).
