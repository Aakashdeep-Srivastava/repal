# RePal — Product Scope & Engineering Roadmap

_Created 2026-11-21 (Phase 0 scope freeze); roadmap status updated 2026-11-23. This doc formally separates the two product scopes and freezes the build order so we stop expanding breadth and start proving the commercial economics. **Progress: Phase 0 done; Phases 2, 3, and 4 are engineering-complete and merged to `main`; Phase 1 (applying the migrations to prod) and a signed partner remain the gates to activating the commercial loop live.** For the current implementation state, see [`PRD_PROGRESS.md`](./PRD_PROGRESS.md); for the original architecture, [`TECH_PRD.md`](./TECH_PRD.md)._

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
| Original AI + PayPal MVP (Scope A) | **85–90%** | Agent, optimizer, Orders, Vault, receipts, reporting, deploy, QA; now on a custom domain |
| Hackathon demonstration | **80–85%** | Strong single-seller demo; payout can be simulated; ledger not active in prod |
| Expanded coupon network (Scope B) | **55–60%** | Per-merchant routing **shipped**; redemption-confirmation + commercial-pilot code **merged** (adapter, settlement gate, campaign reporting) but tables unmigrated + no signed partner |
| Commercial validation | **Early stage** | Code path exists end-to-end; still **no verified partner redemption economics or incremental-sales results** (the code is honest-dormant) |

**Correction on record:** the site is deployed on AWS, but the PayPal seller is a **sandbox** account. This is **not** evidence of production live-money processing.

---

## 3. Frozen roadmap (strict dependency order)

> Rule: do not mix scopes or add features out of order. Each phase delivers a checkpoint (changed files + commit, tests run + actual results, evidence, remaining deps, prod risks, next phase). **No production DB mutation or live-payment without explicit approval.**

### Phase 0 — Scope freeze & doc reconciliation · **✅ DONE** (merged, PR #95)
Reconciled `9c4568f` with `main` (code identical to deployed main — only docs differed). Updated `PRD_PROGRESS.md` against actual code; fixed `QA.md` consistency (F1 done, CI status, sandbox-not-live-money); preserved `TECH_PRD.md`; created this scope doc.

### Phase 1 — Activate the economic engine (ledger) · **⏳ PENDING APPROVAL (not executed)**
Review the ledger/redemption migrations; verify on the isolated Neon QA branch; check prod data for uniqueness conflicts (esp. the `Redemption.oneTimeKey` unique index); prepare backup + recovery instructions; provide migration SQL + verification results for **manual review**. **Prod migrations NOT executed — still awaiting explicit approval.** On approval, activate: campaign budgets, publisher agreements, attribution, commission accounting, media credits, customer reward liabilities, redemption accounting. _(The 3 migrations are committed: `_add_commercial_ledger`, `_add_redemption_onetime_unique`, `_add_redemption_confirmation`.)_

### Phase 2 — Per-merchant PayPal routing · **✅ SHIPPED** (merged, commit `598f1a5`; live)
Separate single-seller checkout flows. Built: trusted merchant→PayPal seller registry (`lib/paypal/merchants.ts`), server-side per-merchant credentials (`PAYPAL_CLIENT_ID__<MID>`), product→merchant mapping, per-seller order create/capture, per-merchant webhook verification, failure isolation. Platform seller + a dedicated `cleartrip` seller wired in Secrets Manager + task def. **One RePal session, separate PayPal approvals + captures — NOT one unified marketplace transaction.**

### Phase 3 — Real coupon redemption (business-critical) · **✅ CODE MERGED** (commit `d838e50`; tables pending migration)
Adapter interface for external coupon validation + redemption (`lib/redemption/`) + settlement gate. Built: adapter layer, code reservation/redemption, attribution, commission confirmation + reversal. **Internal eligibility checks ≠ merchant-confirmed redemption** — a commission is recognised payable only after merchant/affiliate-network confirmation. Dormant in prod until migration `_add_redemption_confirmation` is applied.

### Phase 4 — Commercial pilot readiness · **✅ ENGINEERING COMPLETE** (merged, commit `34e42c9`; partner-gated)
Reference-partner endpoint + real-HTTP redemption confirmation (`AffiliateHttpAdapter`) + `/api/insights/campaigns` campaign reporting. **Never combine advertising credits, customer cashback, and cash commissions in one balance** (three never-conflated balances). `PARTNER_REF_API_KEY` is live in prod; `AFFILIATE_API_URL` is **deliberately unset** (no signed partner yet → no real external confirmation fires). The remaining gate is a **signed reference partner**, not more code.

### Phase 5 — True marketplace checkout · **✅ CODE STRUCTURE BUILT / ⏳ partner-approval-gated**
The *buildable* part is done (`lib/paypal/marketplace.ts` + `app/api/pay/marketplace/order` + 14 unit tests): a single buyer approval settling across multiple sellers — one `purchase_unit` **per seller** with its own `payee` + `payment_instruction.platform_fees`, and the **`PARTIALLY_COMPLETED` ("HTTP-207") capture parsing** that a multi-seller capture requires (some legs settle, some fail). It is **gated OFF** (`PAYPAL_MARKETPLACE_ENABLED`, default `0`); the route returns `501` + the exact request it would send. **Going live still needs PayPal marketplace partner approval + sellers onboarded (Partner Referrals)** — an external gate, not more code. Until then it stays dormant; the live path is Phase 2 per-merchant routing.

---

## 4. Honesty boundary
See [`PRD_PROGRESS.md` §16](./PRD_PROGRESS.md#16-honesty-boundary--what-repal-must-not-claim-prematurely). Key: sandbox ≠ live money; some payouts are simulated; merchant redemption is not yet verified; multiple merchants per session is achievable but a single cross-seller PayPal transaction is not (needs approval); coupon face value ≠ merchant cost.

---

## 5. Safety requirements (every phase)
Isolated feature branches · synthetic QA data · never expose merchant secrets · no production PayPal credentials in tests · no production DB mutation without explicit approval · preserve all E2E + financial-reconciliation tests · do not claim live merchant integration when using seeded offers · keep all simulations explicitly labelled.

---

## 6. Final verdict
The technical foundation is strong. The risk now is building too many things without proving the business economics. The single most valuable next result is **one real coupon publisher + one real merchant + one verified redemption + one positive commercial transaction cycle** — worth more than another large feature release.
