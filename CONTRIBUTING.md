# Contributing to RePal — Ground Rules

We're four people shipping a PayPal-central fintech agent in ~11 days. These
rules keep us fast **and** professional. Read once; follow always.

> **Prime directive (non-negotiable):** the LLM never computes money. Everything
> in `lib/` (optimizer, policy, receipts, grounding) is deterministic and
> unit-tested. If a money number can be produced by a model, it's a bug.

---

## 1. Branching & PRs

- `main` is **always deployable**. Never push to `main` directly.
- Branch naming: `<area>/<short-desc>` — e.g. `optimizer/stacking`, `api/mandates`, `ui/approval-sheet`, `paypal/payouts`.
- One PR = one focused change. Keep them small enough to review in <15 min.
- PRs need **1 approving review** before merge. Merge via **squash**.
- A PR must: build (`npm run build`), typecheck (`npm run typecheck`), and pass tests (`npm test`). CI enforces this.
- Touching someone else's area? Tag the owner (see `docs/TEAM.md` / `CODEOWNERS`).
- Rebase on latest `main` before asking for review. No merge commits into feature branches.

## 2. Commits

- Conventional-ish: `area: what changed` — e.g. `policy: add cap + threshold gate`.
- Commit working increments; don't commit broken code to a shared branch.
- Never commit secrets. `.env` is git-ignored. Signing keys (`*.key`) are ignored.

## 3. Code conventions

- **TypeScript strict**, no `any` without a `// reason:` comment.
- Money is always `*Usd` (a `number`, USD). INR is **display-only** via `lib/fx.ts`.
- Deterministic core (`lib/`) imports **no** LLM SDKs. Enforced by review.
- Validate all external input (LLM output, API responses, webhooks) with **Zod** at the boundary.
- Path alias `@/` → repo root (e.g. `import { optimize } from "@/lib/optimizer"`).
- Format: Prettier defaults. Lint before pushing (`npm run lint`).

## 4. Tests

- Every function in `lib/` ships with tests beside it (`*.test.ts`).
- T&C parsing has a golden eval: `evals/tnc-golden.json`, run in CI.
- Target: `lib/optimizer`, `lib/policy`, `lib/receipts`, `lib/tnc` at ~100%.
- Run locally: `npm test` (once) or `npm run test:watch`.

## 5. Contracts & boundaries

- The stable interfaces live in `lib/types.ts`. **Changing a shared type = ping the team** before merging — it ripples across agents, API, and UI.
- Agents (`agents/`) call deterministic core via its public functions only.
- API routes (`app/api/`) are thin: validate → call `lib/` → respond. No business logic in routes.

## 6. Environment & secrets

- Copy `.env.example` → `.env.local` and fill your own sandbox keys.
- Share sandbox credentials via our private team channel, **never** in the repo or PRs.
- PayPal is **sandbox only**. No real money, ever (`DEMO_MODE=true`).

## 7. Dependencies

- Discuss before adding a heavy dependency. Pin versions (see PRD §13 "verify").
- Design/effect libraries: **≤5 effect flourishes total** (PRD §12). Don't stack them.

## 8. Daily rhythm

- Short async standup in the team channel: yesterday / today / blockers.
- Push WIP branches daily so work is visible and mergeable.
- Demo-critical path first (PRD §11 video beats). Polish after the flow works end-to-end.

---

### Quick start

```bash
cp .env.example .env.local        # fill your sandbox keys
npm install
npm run prisma:generate
npm run dev                       # http://localhost:3000
npm test                          # deterministic core
```

See `docs/TEAM.md` for who owns what and `docs/TECH_PRD.md` for the full spec.
