# RePal — Product Scope & Engineering Roadmap

_Created 2026-11-21 (Phase 0 scope freeze). This doc formally separates the two product scopes and freezes the build order so we stop expanding breadth and start proving the commercial economics. For the current implementation state, see [`PRD_PROGRESS.md`](./PRD_PROGRESS.md); for the original architecture, [`TECH_PRD.md`](./TECH_PRD.md)._

---

## 0. The strategic decision

Stop expanding hackathon scope. Turn RePal into a coherent commercial product by **proving one real redemption + one positive commercial cycle**, not by adding more integrations.

**Positioning (one measurable proposition):**
> **RePal turns forgotten promotional rewards into actual, attributable purchases.**
> Differentiation = consumer reward intelligence + deterministic savings optimization + delegated PayPal payments + merchant-side commercial attribution.

The deterministic money/policy architecture is **unchanged in principle**: the LLM never computes or authorizes money.

---

## 1. Two scopes — keep them separate

### Scope A — Core engine (B2C) · **SHIPPED**
**RePal — AI Rewards-to-Money Agent.** Consumers connect rewards, the AI understands their terms, a deterministic optimizer finds the best purchase, and PayPal executes within delegated (Vault) authority. Reward discovery → optimization → spending → verification.

This is the proven foundation. **Preserve it as the core engine. Do not throw it away to build a generic coupon marketplace.**

### Scope B — Commercial expansion (B2B2C) · **EARLY STAGE**
**RePal — Rewards Activation Network.** Merchants and coupon publishers distribute promotional inventory; RePal activates forgotten offers, tracks *actual* redemptions, and shares agreed commercial value. Campaigns, publisher commissions, advertising credits, merchant ROI.

Scope B is the commercial *expansion* of Scope A — not a replacement.

---

## 2. Completion verdict (qualitative, not measured PM %)

| Dimension | Estimate | Note |
|---|---|---|
| Original AI + PayPal MVP (Scope A) | **85–90%** | Agent, optimizer, Orders, Vault, receipts, reporting, deploy, QA |
| Hackathon demonstration | **80–85%** | Strong single-seller demo; payout can be simulated; ledger not active in prod |
| Expanded coupon network (Scope B) | **35–40%** | Ledger code exists; real merchant redemption, publisher relationships, multi-merchant routing incomplete |
| Commercial validation | **Early stage** | No verified partner redemption economics or incremental-sales results yet |

**Correction on record:** the site is deployed on AWS, but the PayPal seller is a **sandbox** account. This is **not** evidence of production live-money processing.

---

## 3. Frozen roadmap (strict dependency order)

> Rule: do not mix scopes or add features out of order. Each phase delivers a checkpoint (changed files + commit, tests run + actual results, evidence, remaining deps, prod risks, next phase). **No production DB mutation or live-payment without explicit approval.**

### Phase 0 — Scope freeze & doc reconciliation · **IN PROGRESS (this change)**
Reconcile `9c4568f` with current `main` (verified: code identical to deployed main — only docs differ). Update `PRD_PROGRESS.md` against actual code; fix `QA.md` consistency (F1 done, CI status, sandbox-not-live-money); preserve `TECH_PRD.md`; create this scope doc. **Done when these docs are consistent and merged to main.**

### Phase 1 — Activate the economic engine (ledger) · **NEXT (prep only; needs approval to execute)**
Review both ledger migrations; verify on the isolated Neon QA branch; check prod data for uniqueness conflicts (esp. the new `Redemption.oneTimeKey` unique index); prepare backup + recovery instructions; provide migration SQL + verification results for **manual review**. **Do NOT execute prod migrations without explicit approval.** On approval, activate: campaign budgets, publisher agreements, attribution, commission accounting, media credits, customer reward liabilities, redemption accounting.

### Phase 2 — Per-merchant PayPal routing
Separate single-seller checkout flows (Seller A / Seller B sandbox accounts). Build: trusted merchant→PayPal config registry, server-side per-merchant credentials, product→merchant mapping, per-seller OAuth token caching, per-seller order create/capture, per-merchant webhook verification, seller-level reconciliation, failure isolation. **One RePal session, separate PayPal approvals + captures — NOT one unified marketplace transaction.**

### Phase 3 — Real coupon redemption (business-critical)
Adapter interface for external coupon validation + redemption; integrate **one** authorized merchant / coupon issuer. Build: offer feed/API, coupon validation, code reservation/redemption, order confirmation, attribution, commission confirmation + reversal. **Internal eligibility checks ≠ merchant-confirmed redemption.** Recognize a commission as payable only after required merchant/affiliate-network confirmation.

### Phase 4 — Commercial pilot readiness
One publisher + 1–2 merchants. Workflows: publisher inventory, campaign budgets, distribution rights, attribution, redemption confirmation, commission settlement, non-cash media credits, reward liabilities, campaign reporting. **Never combine advertising credits, customer cashback, and cash commissions in one balance.** Measure: redemption rate, incremental purchases, merchant ROI, affiliate income, RePal contribution margin.

### Phase 5 — True marketplace checkout (later)
Only after PayPal marketplace **partner approval**: a single buyer approval settling across multiple sellers (`purchase_units[]` + `payee`). Code structure + HTTP-207 handling can be built earlier against sandbox, but cannot go live until approved.

---

## 4. Honesty boundary
See [`PRD_PROGRESS.md` §16](./PRD_PROGRESS.md#16-honesty-boundary--what-repal-must-not-claim-prematurely). Key: sandbox ≠ live money; some payouts are simulated; merchant redemption is not yet verified; multiple merchants per session is achievable but a single cross-seller PayPal transaction is not (needs approval); coupon face value ≠ merchant cost.

---

## 5. Safety requirements (every phase)
Isolated feature branches · synthetic QA data · never expose merchant secrets · no production PayPal credentials in tests · no production DB mutation without explicit approval · preserve all E2E + financial-reconciliation tests · do not claim live merchant integration when using seeded offers · keep all simulations explicitly labelled.

---

## 6. Final verdict
The technical foundation is strong. The risk now is building too many things without proving the business economics. The single most valuable next result is **one real coupon publisher + one real merchant + one verified redemption + one positive commercial transaction cycle** — worth more than another large feature release.
