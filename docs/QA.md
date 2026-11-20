# RePal — QA & E2E Testing

Autonomous QA framework for a system that moves money. Deterministic tests prove every coupon redemption, PayPal capture, commission, refund and payout reconciles; AI agents explore the real UI and report reproducible findings. **No test ever touches production; no live payments.**

## 1. Stack & layers

| Tool | Role |
|---|---|
| Playwright Test (`e2e/`) | Deterministic browser E2E |
| Vitest (`*.test.ts`) | Deterministic business logic (optimizer, policy, receipts, **ledger**) |
| Integration smokes (`scripts/*-smoke.ts`) | DB-backed ledger + security reconciliation against an isolated branch |
| PayPal Sandbox | Real Orders/Vault/capture/refund; simulated payout clearly labelled |
| Prisma | Isolated test DB + deterministic assertions |

**Layer 1 — deterministic** (unit + E2E + ledger/security smokes). **Layer 2 — AI exploratory** (the agent briefs in `tests/agents/`). **Layer 3 — financial/security verification** (`tests/helpers/ledger-assertions.ts`, `scripts/security-ledger-smoke.ts`) — independent of any green UI message.

## 2. The six-agent QA team
Instruction briefs live in `tests/agents/` (`orchestrator`, `consumer`, `merchant`, `publisher`, `payment`, `security`, `ui`). Each has a scoped mission, scenarios→expected, evidence requirements, and the existing coverage it maps to. They explore real screens, classify issues (real defect vs missing feature vs environmental/gated), and never green-wash.

## 3. Safety model (spec §8 — non-negotiable)
- **Prod DB off-limits.** Tests run only against an **isolated Neon branch** via `QA_DATABASE_URL`. `tests/helpers/database.ts` fails closed if that URL is unset or equals the app's `DATABASE_URL`.
- **Sentinel preflight.** Before any browser E2E, the running app is confirmed bound to the isolated DB by serving a QA-only sentinel row (`/api/wallet?userId=qa-sentinel-*`). If the sentinel isn't returned, do NOT run the mutating suite.
- **PayPal Sandbox only.** Never live payments/payouts. A sandbox payout restricted by the India business account degrades to a **clearly-labelled SIMULATED** payout — never reported as a real transfer.
- Per-worker synthetic users (`tests/fixtures/sandbox-users.json`); each cleans up only its own rows (`cleanupByUserPrefix`).

## 4. Running the suites (safe recipe)
```bash
# 1. Isolated DB: create a Neon branch, apply ALL migrations, seed:
#    prisma db execute --url <QA_DIRECT> --file prisma/migrations/<each>/migration.sql
#    DATABASE_URL=<QA> tsx prisma/seed.ts && tsx prisma/seedLedger.ts  (+ seedCatalog)
# 2. Unit (DB-free, fast):
npm run test:unit
# 3. Ledger + security smokes (deterministic, isolated DB):
QA_DATABASE_URL=<QA> npm run qa:security
DATABASE_URL=<QA> DIRECT_URL=<QA_DIRECT> npm run qa:ledger
# 4. Browser E2E (start dev bound to QA DB + rate-limit bypass, verify sentinel, then):
DATABASE_URL=<QA> DIRECT_URL=<QA_DIRECT> RATE_LIMIT_DISABLED=1 npm run test:e2e
```
`RATE_LIMIT_DISABLED=1` is honored **only** when `NODE_ENV !== production` (prod rate limiting is never disablable).

## 5. Feature inventory

| Area | Status |
|---|---|
| Judge/demo login, session | ✅ Implemented |
| PayPal OIDC login | ⚠️ Gated (sandbox account; India can't accept USD) |
| Wallet, reward import, optimizer, T&C grounding | ✅ Implemented |
| Discount calc, stacking (`not_combinable_group`), one-time redemption | ✅ Implemented |
| Mandate/policy gate, Ed25519 receipts | ✅ Implemented |
| PayPal order/capture/refund/payout/webhook (single-seller) | ✅ Implemented (payout simulated-fallback) |
| Commercial ledger (campaigns, agreements, attribution, commission, media credits, cashback) | ✅ Implemented (migrations pending manual prod apply) |
| Multi-seller Orders v2 + HTTP 207 handling | ❌ Missing (seller onboarding gated) |
| Signed-in persona name in app shell | ❌ Missing (see F1) |
| CI pipeline, mobile/WebKit projects, `/qa` dashboard | ❌ Not yet built |

## 6. Coverage matrix & real results (this run)

- **Unit/logic: 177 passed, 20 skipped** (optimizer, policy, receipts, tnc, funding, toolkit, **ledger commission/cashback/balances**).
- **Ledger integration smoke: 19/19** (commission split, budget depletion, attribution, cashback, one-time guard, invalid code, balances, markPayable, reversal).
- **Security smoke: 7/7** (concurrent one-time → exactly one; per-user scope; wrong code; media credits never payable; reversal leaves media credits untouched).
- **Browser E2E: 17/17 passed** against the isolated DB (after fixing F1 + the rate-limit testability bypass). An earlier run was 15/17 — the 2 were finding F1 (now fixed), and 3 shopping-journey tests first failed on self-inflicted 429s → fixed by the test-only rate-limit bypass (§3).

## 7. Findings (classified, not green-washed)

- **F1 — real defect (FIXED):** after a client-side "Try Live Demo" login the shell greeted the user as "Guest"/"there". Root cause: the `judgeLogin` mutation navigated to `/wallet` without invalidating the `["me"]` React Query cache (populated as `null` on the logged-out landing page), so the shell read stale `me=null`. Fixed in `Landing.tsx` + `SiteFooter.tsx` (`invalidateQueries(["me"])` before navigating). `home.spec` + `journey.spec` now pass. (`components/nav/UserMenu.tsx` remains unmounted dead code — separate cleanup.)
- **F2 — known gap (deferred):** `app/api/pay/capture` reads `purchase_units[0].payments.captures[0].id` with no status inspection — no `PARTIALLY_COMPLETED` / HTTP 207 handling. Safe today (single-seller) but must be fixed with multi-seller Orders v2. `tests/helpers/paypal.ts#readCapture` already surfaces per-unit status for the future test.
- **F3 — real defect (FIXED this session):** concurrent one-time redemption double-redeemed (TOCTOU race; the app-level `findFirst` guard didn't hold). Fixed with a DB-level unique `oneTimeKey` index (`recordRedemption` sets it for one-time offers, `reverseRedemption` frees it, a P2002 maps to `already_redeemed`). Regression-guarded by `qa:security`.

## 8. Remaining work
1. CI (GitHub Actions): unit → migration-validation → E2E (isolated branch) → ledger/security smokes → report; block merge on fail.
2. Playwright projects for Mobile Chromium + WebKit; automated a11y assertions.
3. Duplicate-webhook idempotency + duplicate-capture + amount-manipulation E2E specs.
4. Multi-seller 207 handling + its tests (F2).
5. `/qa` engineering dashboard.
6. Delete the unmounted `components/nav/UserMenu.tsx` dead code (or mount it as the real account menu).
