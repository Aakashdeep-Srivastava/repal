# RePal — Complete Implementation State (End-to-End)

_Last updated: 2026-11-23 · This is the authoritative, current source of truth for what is built, live, gated, and pending. It supersedes the 2026-11-21 snapshot (which predated Phases 2–4 and the custom domain). `docs/TECH_PRD.md` holds the original vision/architecture; where the two disagree, THIS doc reflects reality._

---

## 0. What RePal is

**RePal = Rewards + PayPal** — an agentic rewards-to-money layer. You state a goal in plain language; an AI reads your rewards' fine print, a **deterministic** optimizer finds the cheapest SKU *after* your rewards, and **PayPal moves the money across the whole lifecycle** — identity, delegated authority (Vault), pay-in (Orders), pay-out (Payouts, which liberates stuck rewards into real cash), and reversal (Refunds).

**Litmus test:** remove PayPal and the agent cannot act, get paid, or pay you back. The mandate *is* a PayPal Vault token; cashback is settled with PayPal Payouts.

**Prime directive (enforced structurally, not by convention):** **the LLM never computes money.** Every amount flows from deterministic integer-cents code (`lib/optimizer`, `lib/stack`, `lib/ledger`) or a PayPal response. The model only routes, reads, extracts, explains, and asks — at `temperature: 0`.

- **Live:** `https://repal.shop` (primary, custom domain) · `https://d14t147d5f4q6i.cloudfront.net` (CloudFront origin, still live — the hackathon submission link). AWS ECS/Fargate behind CloudFront.
- **Repo:** `github.com/Aakashdeep-Srivastava/repal`.

---

## 1. Status headline (2026-11-23)

The defining thesis — delegated authority, deterministic policy enforced at spend time, reward→cash liberation, an agent that executes within signed limits — is **wired end-to-end and deployed**. Since the 2026-11-21 snapshot, the whole frozen commercial roadmap (Phases 2–4) landed in `main`, and the app moved onto a real domain.

- **✅ Real USD PayPal checkout works end-to-end — in PayPal SANDBOX.** ⚠️ This is a **real payment *flow*, not real money.** The app is deployed on AWS, but the PayPal seller is a **sandbox** business account; no live funds move. The long-standing blocker (the sandbox *seller* was an India business account that can't accept USD) is **cleared**: a US *sandbox* business seller ("RockstartGame" app under `gta6@rockstargames.com`) is now the live `PAYPAL_CLIENT_ID`. Verified end-to-end — a live order resolves under the US app, and a full run captured sandbox USD 12.34 with a signed receipt. **"Deployed on AWS" ≠ "live-money processing."**
- **✅ Custom domain live (2026-11-23).** `https://repal.shop` serves the app over HTTPS (apex + `www`), via **Route 53 + ACM (us-east-1) + CloudFront aliases** on distribution `ECX7AU2KJOIDE`. DNS moved off GoDaddy to Route 53. The CloudFront URL stays live (hackathon submission link). The app's OAuth callback origin (`PAYPAL_OIDC_REDIRECT`, which also derives the Gmail callback) is being switched to `repal.shop` once both consoles register it.
- **✅ Phase 2 — per-merchant PayPal routing (merged + live).** A trusted-merchant→seller registry routes each product's checkout to the seller that owns it (platform seller + a dedicated `cleartrip` seller app, wired in Secrets Manager + task def). One RePal session, **separate** single-seller approvals + captures — not one cross-seller marketplace transaction. See §6.
- **✅ Phase 3 — merchant-confirmed redemption (merged; dormant pending migration).** An adapter layer + settlement gate: a commission is recognised payable **only after** merchant/affiliate confirmation, not on internal eligibility. Code in `main` (`lib/redemption/`); its migration `20261121020000_add_redemption_confirmation` is **pending manual prod apply**.
- **✅ Phase 4 — commercial pilot loop (merged; partner-gated).** Reference-partner endpoint + real-HTTP redemption confirmation (`AffiliateHttpAdapter`) + `/api/insights/campaigns` reporting. Engineering complete; `PARTNER_REF_API_KEY` is live in prod but `AFFILIATE_API_URL` is **deliberately unset** (honest — no signed partner yet, so no real external confirmation fires).
- **✅ Shop discovery hardened (2026-11-23).** Fixed a 400 on empty/blank search (Channel3 rejects a null query) — empty now fans out to seeded browse — and added Amazon-style category navigation. See §3.

**One important caveat:** the **commercial-ledger + redemption-confirmation DB tables are not yet in production.** Their three migrations (`20261121000000_add_commercial_ledger`, `20261121010000_add_redemption_onetime_unique`, `20261121020000_add_redemption_confirmation`) are committed but **applied manually** (CI does not run migrations). Until applied, the ledger/redemption code is **dormant in prod** (write paths are best-effort/try-catch so they no-op) — the consumer demo does not need it.

---

## 2. Architecture at a glance

Single **Next.js 15** app (App Router, React 19, TypeScript). A clean `lib/` core holds all deterministic logic; `agents/` holds the LLM units; `app/` holds pages + API routes.

**Two load-bearing invariants:**
1. **LLM never computes money.** The orchestrator calls one composite tool (`plan_purchase`) that runs the deterministic pipeline server-side and returns finished numbers + a policy verdict. Spending re-runs the policy gate a *second* time, so the model can't bypass the mandate even with a bad plan.
2. **Policy checked twice.** Once at plan-ranking time (`checkPolicy`), and **again server-side immediately before money moves** (`gateSpend`), against the real DB mandate (never client-supplied), with a tampered mandate hard-denied.

**Layers:** Auth/session → AI agents (intent, terms, explainer, orchestrator) → deterministic pipeline (optimizer, policy, stack) → PayPal money adapters → signed receipts/ledger → insights. Plus ingestion (rewards in) and the commercial ledger (RePal's books).

---

## 3. The money lifecycle (end-to-end)

| Stage | What happens | Key files |
|---|---|---|
| **Discover** | Channel3 product search (live key → real SKUs; else 12 labelled sandbox products). 60s LRU cache; cheapest-first, ties → higher affiliate commission. Empty/blank query fans out to **seeded browse** (Channel3 rejects a null query); **Amazon-style category nav** (`lib/shop/categories.ts`, `components/shop/CategoryBar.tsx`). | `lib/channel3.ts`, `lib/shop/products.ts`, `app/api/products` |
| **Plan / optimize** | Deterministic branch-and-bound over SKU × stackable rewards → up to 3 plans ("Cheapest after rewards", "Keep points") + per-reward rejection with the verbatim clause. Integer cents throughout. | `lib/pipeline.ts`, `lib/optimizer/*`, `app/api/plan`, `app/api/eligibility` |
| **Policy gate #1** | `checkPolicy` → `allow` / `ask` / `deny` on each plan (cap, budget, allow-lists, approval threshold). | `lib/policy/index.ts` |
| **Order** | PayPal Orders v2 create. Buyer-present → `approveUrl` (return/cancel built from the public base, never the request host). Agent path → `payment_source.paypal.vault_id`, no redirect. Agent-selected funding (Pay Later ≥$100 / Venmo ≤$30 / balance) with fallback. | `lib/paypal/orders.ts`, `lib/paypal/funding.ts`, `app/api/pay/order` |
| **Approve** | Buyer approves on PayPal's hosted page → returns to `/checkout?paypal=return`. | `components/shop/PaymentFlow.tsx` |
| **Policy gate #2 + Capture** | `gateSpend` re-checks the real mandate (deny→403, ask→409); then capture; then issue a signed receipt. Best-effort `recordRedemption` to the ledger. | `app/api/pay/capture`, `lib/policy/gate.ts`, `lib/agent/actions.ts` |
| **Receipt** | Canonical JSON → SHA-256 → **Ed25519** signature → `Receipt` row; publicly verifiable at `/verify/:id`. | `lib/receipts/*`, `app/verify/[id]` |
| **Liberate (payout)** | Reward → cash via PayPal Payouts, bounded to the reward's value, no double-cash. Honest **simulated** fallback (real signed receipt, labelled) if the sandbox sender is restricted. | `lib/payout/liberate.ts`, `app/api/pay/payout` |
| **Refund + webhooks** | Full/partial refund + reversal receipt; signature-verified webhooks update Payout/Refund status. | `lib/paypal/refunds.ts`, `app/api/pay/refund`, `app/api/webhooks/paypal` |
| **Insights** | Self-contained dashboard from RePal's own signed artifacts + live PayPal Transaction Search + Balances (RePal's merchant account, clearly labelled). | `app/insights`, `lib/paypal/reporting.ts`, `components/insights/*` |

A **demo-capture** path (`/api/pay/demo-capture`) mirrors capture with a real Ed25519 receipt but DEMO PayPal ids, used when PayPal is unconfigured — the reliable, repeatable demo payment.

---

## 4. AI / agent layer

**Four agents, all `temperature: 0`:**
- **A0 Orchestrator** (`agents/orchestrator.ts`) — AI SDK `ToolLoopAgent`, `stepCountIs(10)`. Tools: `render_intent`, `scan_wallet`, `scan_inbox` (Gmail read-only), `plan_purchase` (the deterministic pipeline), `explain_plan`, `pay`, `payout`, `grant_mandate`. PayPal-toolkit tools merged *first* so RePal's gated money tools win any name clash.
- **A1 Intent** (`agents/intent.ts`) — `generateText` + `Output.object`; extracts only what the user said, no math.
- **A2 Terms** (`agents/terms.ts`) — structured T&C extraction into a fixed 11-predicate vocabulary, then `assertGrounded` (anti-hallucination). Runs offline during ingestion, not in the orchestrator loop.
- **A5 Explainer** (`agents/explainer.ts`) — narrates a finished plan's existing numbers; forbidden to compute.

**LLM provider chain** (`lib/ai/bedrock.ts`, `lib/ai/fallback.ts`) — despite the filename, a **multi-provider fallback chain** exported as `claude`. Prod order (`AI_PROVIDER_ORDER` in the task def): **`gemini, groq, openrouter, bedrock`** — so AI is live via **Gemini-first** regardless of the Bedrock use-case-form gate. Robust failover: errors classified fatal / transient / provider-down, per-provider cooldowns, backoff honoring `Retry-After`. Degrades to HTTP-200 `status:"blocked"` (not a 500) when no provider is configured.

**Ingestion** (`lib/ingest/*`) — 5 adapters (gmail, paypal, card, loyalty, channel3); **only Gmail pulls real data** (read-only `gmail.readonly`, stores only subject+snippet). Others are clearly-labelled SANDBOX samples. Bounded concurrency 4; idempotent upsert on `(userId, source, termsRaw)`; parse skipped wholesale when no LLM is configured (rewards stored raw).

**T&C grounding** (`lib/tnc/*`) — 11 predicates; the grounding guard rejects any number/date not written verbatim in the source clause. This is what structurally prevents the model inventing a money figure.

---

## 5. Commercial ledger (RePal's own books) — built, deployed, dormant-in-prod

PayPal moves eligible payment money; this ledger accounts for everything it does not: coupon discounts, campaign budgets, non-cash media credits, publisher commissions, customer cashback liabilities. All integer cents, deterministic.

- **Tables** (11): `Publisher`, `PartnerAgreement`, `CampaignBudget`, `Redemption` (unique `oneTimeKey`), `Attribution`, `CommissionLedger`, `MediaCreditLedger`, `CustomerRewardLedger`, `PaymentLedger`, `PayoutBatch`, `PayoutItem`.
- **Logic** (`lib/ledger/*`): `recordRedemption` (atomic — commission split + campaign depletion + attribution + cashback accrual + **atomic one-time-use** via a unique index), `reverseRedemption`, `computeCommission` (basis points), `rollupBalances` (three never-conflated balances), `markPayable`.
- **Wired** into `/api/pay/capture` best-effort (never fails the capture).
- **Status:** code LIVE; **tables pending the 2 manual migrations** → dormant in prod until applied. The actual publisher/cashback *payout* is US-sandbox-sender gated (same as reward liberation).

---

## 6. PayPal integration — current live status

RePal uses **~9 PayPal products as one money loop** — the core differentiator:

| Product | Use | Status |
|---|---|---|
| Log in with PayPal (OIDC) + Identity | sign-in | ✅ live (judge/demo login is the primary demo entry; OIDC also wired) |
| Vault v3 (setup + payment tokens) | the delegated-authority mandate | ✅ wired (opt-in via `?vault=1`; default = instant in-app signed mandate, as sandbox Vault is fragile) |
| Orders v2 (create + capture) | pay-in, incl. agent-initiated `vault_id` (no redirect) | ✅ **live USD** on the US seller |
| Agent-selected funding (`payment_source`) | Pay Later / Venmo / balance | ✅ wired (deterministic `selectFunding`) |
| Payouts | reward→cash liberation | ✅ wired + honest simulated fallback |
| Refunds | reversal + reversal receipt | ✅ wired |
| Webhooks (signature-verified) | drive Payout/Refund status | ✅ wired (capture/approval/dispute events stored but inert — see gaps) |
| Transaction Search (Reporting) | live settled-txn history on `/insights` | ✅ live |
| Balances (Reporting) | live account balance KPI | ✅ live |
| Agent Toolkit | read/post-purchase tools only | ✅ flag ON in prod (`PAYPAL_AGENT_TOOLKIT=1`); money-moving tools deliberately excluded |

**Sandbox accounts (2026-11-21):**
- **Sellers (US business):** `gta6@rockstargames.com` (app `APP-11Y82502XE264774E` = **live prod seller**, $5k) and `airtribe@xphora.ai` (app `APP-68M28684HF263950W`, $100k, validated alternate). Payment Review is OFF on both → instant captures.
- **Buyer (US personal):** `aakash@paypal.com` ($100k, test cards + banks).
- The old India account is retired from the pay-in path.

**Per-merchant routing (Phase 2) is now built + live.** A trusted-merchant→seller registry (`lib/paypal/merchants.ts`) routes each product's order/capture to the seller that owns it: the platform seller (`PAYPAL_CLIENT_ID`) by default, or a dedicated seller app for a mapped merchant (`PAYPAL_CLIENT_ID__<MID>`, e.g. `__CLEARTRIP`, wired in Secrets Manager + task def). Each purchase is a separate single-seller order + approval + capture under one RePal session — **not** one cross-seller transaction. A merchant with no dedicated app falls back to the platform seller (failure-isolated).

**Gating that remains:** a *single* PayPal checkout that splits across *multiple* sellers at once (true marketplace, `purchase_units[]` + `payee`) needs PayPal **marketplace partner approval** — an external gate (Phase 5). Dedicated seller apps that also need live payout/dispute webhooks would each need their own webhook id registered + a `PAYPAL_WEBHOOK_ID__<MID>` secret (the `cleartrip` app has none yet; demo uses synchronous capture, so not required).

---

## 7. Data model (25 Prisma models)

- **Core:** `User`, `Mandate`, `Reward`, `Offer`, `AgentRun`, `Plan`, `Receipt`, `ToolTrace`, `WebhookEvent`, `GoogleToken`, `Payout`, `Refund`.
- **Cold-start catalog:** `Merchant`, `CatalogOffer` (+ `code`/`publisherId`/`campaignId`/`stackable`).
- **Commercial ledger (11):** see §5.

All money fields in the ledger are integer cents; receipts/payouts use USD floats at the PayPal boundary. **9 migrations total; the last 3 (commercial ledger + redemption one-time-unique + redemption confirmation) are pending manual prod apply.**

---

## 8. Pages & routes (complete)

**Pages (13):** `/` (landing), `/wallet`, `/shop`, `/product/[id]`, `/checkout`, `/mandate`, `/insights`, `/rescue`, `/stack`, `/connect/gmail`, `/verify/[id]`, `/privacy`, `/terms`.

**API routes (~35), by area:**
- **Auth:** `auth/paypal/{login,callback}`, `auth/{demo-login,judge-login,judge-reset,logout}`, `me`.
- **Wallet/rewards:** `wallet`, `wallet/{import,ingest}`, `rewards/{feed,onboard,save}`.
- **Shop/plan:** `products`, `products/[id]`, `offers`, `plan`, `eligibility`.
- **Pay/money:** `pay/{mode,order,capture,demo-capture,payout,refund}`, `pay/marketplace/order` (Phase 5, gated → 501).
- **Mandates:** `mandates`, `mandates/vault/callback`.
- **Webhooks/insights:** `webhooks/paypal`, `insights`, `insights/campaigns` (Phase 4 campaign reporting), `paypal/transactions`.
- **Agent:** `runs`, `runs/[id]/stream` (SSE).
- **Cron/connect/health/misc:** `cron/expiry`, `connect/gmail{,/start,/callback}`, `health{,/channel3}`, `receipts/[id]`, `payment-methods`.

Session = signed httpOnly cookie (`repal_session`, HMAC, fail-closed in prod). Read routes fall back to the judge persona "Maya"; money routes require a real login (`requireUserId`). Every money/LLM/discovery route is rate-limited.

---

## 9. Sponsor & library integrations

| Integration | Where | Status |
|---|---|---|
| **Channel3** (product discovery) | `lib/channel3.ts`, `/shop` | ✅ live (key in Secrets Manager) |
| **AG Grid** (community) | `/insights` `TransactionGrid` | ✅ live |
| **Bryntum Scheduler** (enterprise) | `/rescue` timeline | ✅ live (license in Secrets Manager `repal/BRYNTUM_LICENSE`) |
| **PayPal Agent Toolkit** | orchestrator (read tools) | ✅ flag on in prod |
| GSAP / Motion / NumberFlow | landing, stack, motion | ✅ (free) |

---

## 10. Security & trust

- **CSP + HSTS + nosniff + frame-deny + referrer/permissions policy** on every route; `poweredByHeader` off. **Deployed live** (verified).
- **PayPal OIDC CSRF** state cookie (constant-time verify); **cron fail-closed** in prod + constant-time secret; **open-redirect closed** (public-base return URLs).
- **Trusted-proxy rate limiting** (XFF offset, so a spoofed header can't mint fresh buckets); a non-prod-only `RATE_LIMIT_DISABLED` bypass for test runs (never disablable in prod).
- **Ed25519** signs both receipts and mandates (userId-bound → no replay); tamper → verify false / gate deny.
- **Atomic one-time-use** redemption enforced by a DB unique index (fixed a real TOCTOU concurrency race the QA suite caught).

---

## 11. QA & testing

- **Unit/logic:** 177 passing (optimizer, policy, receipts, T&C grounding, funding, toolkit, ledger commission/cashback/balances).
- **Ledger + security integration smokes** (`npm run qa:ledger` / `qa:security`): 19/19 + 7/7 against an **isolated** Neon branch (prod-guarded; refuses to run against prod).
- **Playwright E2E:** 17/17 against an isolated DB (landing→login→wallet, ingestion idempotency, full shopping→sandbox payment→verified receipt, SSE stream, receipt verify, reduced-motion, mid-checkout refresh).
- **QA framework** (`tests/`, `docs/QA.md`): six specialist agent briefs + orchestrator, prod-guarded helpers, deterministic ledger-reconciliation assertions, sentinel preflight (proves the app is bound to the test DB before any mutating run).
- **End-to-end demo video:** `RePal-demo-e2e.mp4` (Playwright-recorded).

---

## 12. Deployment & infra

- **CI/CD** (`.github/workflows/ci.yml`): `verify` (typecheck + tests + build) on every push/PR → `deploy` on push to `main` via GitHub **OIDC** (no stored keys) → ECR → ECS/Fargate rollout (circuit breaker + auto-rollback) → `/api/health` smoke → Discord notify. Region `us-west-2`, account `413790912706`.
- **Topology:** `repal.shop` (Route 53) → CloudFront (`ECX7AU2KJOIDE`, ACM cert in us-east-1) → ALB → ECS/Fargate. Secrets in AWS Secrets Manager (`repal/*`).
- **Custom domain:** Route 53 hosted zone `Z0065647E1E211YNSCD7`; apex + `www` are ACM-secured CloudFront aliases. See `docs/DEPLOY_AWS.md`.
- **Migrations are MANUAL** (not in CI) — `prisma migrate deploy` run by hand. ⚠️ The 3 ledger/redemption migrations are pending.
- **Cron:** daily expiry scan via notifier Lambda/EventBridge → `/api/cron/expiry` (secret-gated).
- AWS CLI access for ops via the dedicated `reclevo-repal` profile (IAM user `skydeep`).

---

## 13. Feature status matrix

| Capability | Status |
|---|---|
| Auth (PayPal OIDC + judge/demo login, sessions) | ✅ live |
| Deterministic optimizer / policy / pipeline (enforced twice) | ✅ live |
| Product discovery (Channel3) | ✅ live |
| Ed25519 receipts + mandate signing + `/verify` | ✅ live |
| Delegated authority (Vault mandate + `/mandate` UI) | ✅ live |
| **Real USD PayPal pay-in (US seller)** | ✅ **live (new)** |
| Agent-selected funding | ✅ live |
| Reward→cash Payouts (+ simulated fallback) | ✅ live |
| Refunds + signature-verified webhooks | ✅ live |
| Insights + Transaction Search + Balances | ✅ live |
| Cold-start rewards feed + onboarding | ✅ live |
| Gmail OAuth ingestion (read-only) | ✅ live (user connects) |
| Multi-provider LLM (Gemini-first) + agent runs | ✅ live |
| Sponsors: Channel3 / AG Grid / Bryntum / Agent Toolkit | ✅ live |
| Security headers / CSRF / rate-limit hardening | ✅ live |
| Autonomous QA framework | ✅ in repo |
| Shop category nav + empty-query seeded browse | ✅ live (2026-11-23) |
| Custom domain `repal.shop` (Route 53 + ACM + CloudFront) | ✅ live (2026-11-23) |
| **Per-merchant PayPal routing (Phase 2)** | ✅ **live** (platform + `cleartrip` seller) |
| **Commercial ledger (code)** | ✅ deployed, **tables pending migration** |
| **Merchant-confirmed redemption (Phase 3)** | ✅ code in `main`, **tables pending migration** |
| **Commercial pilot loop (Phase 4)** | ✅ engineering complete, **partner-gated** (`AFFILIATE_API_URL` unset) |
| **Marketplace structure + HTTP-207 handling (Phase 5)** | ✅ code built + tested, **gated OFF** (`PAYPAL_MARKETPLACE_ENABLED=0`) |
| True single-checkout multi-seller marketplace — *live* | ❌ needs PayPal marketplace partner approval |
| Webhook handling for capture/approval/dispute | ❌ stored but inert |

---

## 14. Known gaps & honest tech-debt ledger

1. **Ledger + redemption-confirmation tables not in prod** — 3 migrations await manual `prisma migrate deploy`. Until then the commercial-ledger + Phase 3 redemption demo can't run live (code no-ops).
2. **Webhook `applyEffects` is partial** — only payout-item + refund events mutate state; capture-completed / order-approved / dispute events are stored but inert. Fine for synchronous capture; needed for async robustness.
3. **Single-seller capture assumes `captures[0].id`** (safe for the live single-seller path). The **multi-seller path now has proper `PARTIALLY_COMPLETED` / HTTP-207 handling** (`lib/paypal/marketplace.ts` → `summarizeCapture`), but it's gated OFF pending marketplace partner approval; the single-seller capture route itself still reads `captures[0]`.
4. **New seller app's webhook id not registered** — payout/refund webhook verification would fail against the live `PAYPAL_WEBHOOK_ID` (old app). Demo uses sync capture, so not blocking.
5. **`components/nav/UserMenu.tsx` is dead code** (mounted nowhere) — the shell greeting is the real identity surface (now fixed to show the user).
6. **Ingestion is mostly sample data** — only Gmail is a live source; paypal/card/loyalty/channel3 adapters are labelled SANDBOX stand-ins.
7. **Merchant-confirmed redemption is built but not proven live** — Phase 3 adds the adapter + settlement gate (commission payable only after merchant/affiliate confirmation) and Phase 4 the real-HTTP `AffiliateHttpAdapter`, but with no signed partner (`AFFILIATE_API_URL` unset) and the redemption-confirmation table unmigrated, no real external redemption has fired. The code path is honest-dormant, not exercised.

---

## 15. Open decisions

- **Per-merchant routing — DONE (Phase 2).** Products from different merchants route each purchase to that merchant's own PayPal app (separate single-seller checkouts). Shipped + live (platform + `cleartrip`). No partner approval needed.
- **True single-checkout multi-seller (Phase 5)** — the code structure (`purchase_units[]` + `payee` + `platform_fees`) and `PARTIALLY_COMPLETED` / HTTP-207 capture handling are **built + unit-tested and gated OFF** (`lib/paypal/marketplace.ts`, `app/api/pay/marketplace/order`). Going **live** still needs PayPal **marketplace partner approval** + sellers onboarded via Partner Referrals (external gate) — not more code.
- **Apply the 3 ledger/redemption migrations to prod** — required to demo the commercial ledger + Phase 3 merchant-confirmed redemption (campaigns, commissions, attribution, redemption confirmation). Still pending explicit approval.
- **Sign a reference partner + set `AFFILIATE_API_URL`** — the last gate for a real Phase 4 redemption confirmation to fire.
- **Register a webhook id for the `cleartrip` app** (`PAYPAL_WEBHOOK_ID__CLEARTRIP`) — only if live webhook events (payout/dispute) are needed for that seller on camera.

---

## 16. Honesty boundary — what RePal must NOT claim prematurely

For investor/partner trust and an accurate financial model, these distinctions are load-bearing. Everything in the app is labelled accordingly (`source` provenance, "sandbox" badges, "simulated" payout labels).

| Claim | Actual state |
|---|---|
| "Deployed on AWS = live-money processing" | ❌ No — PayPal is **sandbox**; no real funds move |
| All Google Pay coupons auto-import | ❌ Not established (only authorized Gmail reward mail imports) |
| Every coupon can be stacked | ❌ Only when the issuer's terms permit (`not_combinable_group`) |
| Coupons from different merchants become one discount | ❌ Incorrect — each coupon validates against its own merchant |
| One RePal session can contain multiple merchants | ✅ Achievable (separate single-seller checkouts — not yet built) |
| One PayPal checkout settles all sellers at once | ❌ Requires PayPal marketplace integration + partner approval |
| Coupon face value = merchant cost | ❌ Incorrect |
| Every cashback payout is real | ❌ Some are **simulated** (honest fallback; still a real signed receipt) |
| Merchant redemption is verified | ❌ Not yet — RePal validates with its own rules; no merchant-side handshake |

**Positioning:** RePal turns forgotten promotional rewards into **actual, attributable purchases** — consumer reward intelligence + deterministic savings optimization + delegated PayPal payments + merchant-side commercial attribution. The moat is the merchant redemption + accounting relationship, not more integrations.

---

## 17. Product scope split (B2C core vs B2B2C expansion)

See **[`docs/PRODUCT_SCOPE.md`](./PRODUCT_SCOPE.md)** for the formal separation of the **core consumer engine** (shipped) from the **commercial activation network** (early-stage), and the frozen phase roadmap (Phase 0 reconcile → 1 ledger activation → 2 per-merchant routing → 3 real redemption → 4 pilot → 5 marketplace).
