# RePal — Progress vs the PRD

_Last updated: 2026-11-14 · PayPal AI Hackathon_

## Headline

**~55% → ~80% against the full PRD.** The PRD's defining thesis — delegated
authority, deterministic policy enforcement at spend time, reward→cash
liberation, and an agent that actually executes within limits — is now **wired
end-to-end and deployed** on AWS (`https://d14t147d5f4q6i.cloudfront.net`).

Prime directive preserved throughout: **the LLM never computes money** — every
agent tool delegates to deterministic `lib/` code; amounts come only from the
optimizer's plan or the DB.

---

## Capability-by-capability status

| PRD capability | Before | **Now** | Evidence |
|---|---|---|---|
| Auth / identity (PayPal OIDC, demo, sessions) | ✅ | ✅ | `app/api/auth/*`, `lib/auth/session` |
| Deterministic optimizer / policy / pipeline | ✅ | ✅ **+ enforced at spend** | `lib/optimizer`, `lib/policy`, `lib/pipeline` |
| Product discovery (Channel3) | ✅ | ✅ live | `lib/channel3` |
| Receipts + mandate signing (Ed25519) | ✅ | ✅ **+ verified at spend** | `lib/receipts`, `lib/policy/mandate` |
| **Delegated authority (Vault mandate)** | ❌ no UI, Vault was a TODO | ✅ **real Vault token + `/mandate` UI** | `app/api/mandates/*`, `app/mandate`, `lib/paypal/vault` |
| **Policy gate "again before capture"** | ❌ not enforced | ✅ deny / ask / approved | `lib/policy/gate.ts` (capture + demo-capture) |
| **Reward→cash liberation (Payouts)** | 🟡 fire-and-forget | ✅ persisted + verifiable receipt **+ honest simulated fallback** when the IN sandbox sender can't send | `lib/payout/liberate`, `Payout` model, wallet Cash-out |
| **Agent-selected funding** (Pay Later / Venmo / instant) | ❌ | ✅ the agent *chooses how* to pay the stacked price; one-tap override | `lib/paypal/funding`, `components/shop/FundingSelector`, `app/api/pay/order` |
| **Agent executes money** | 🟡 dormant, no pay tools | ✅ `pay` / `payout` / `grant_mandate` tools | `lib/agent/actions`, `agents/orchestrator` |
| Refunds + webhooks | 🟡 stored-only | ✅ persisted + webhooks update status | `Refund` model, `app/api/webhooks/paypal` |
| Expiry cron | 🟡 stub | ✅ implemented + daily trigger | `lib/rewards/expiry`, `app/api/cron/expiry` |
| **Insights (PRD "Must")** | ❌ not started | ✅ self-contained `/insights` dashboard **+ live PayPal account activity & balance** | `app/insights`, `app/api/insights`, `components/insights/PayPalActivity` |
| Frontend journeys | ✅ | ✅ **+ onboarding, loaders, mandate, insights** | `app/*`, `components/*` |
| Reward ingestion (real data) | 🟡 mock | 🟡 **still mock** (honestly labelled) | `lib/ingest/adapters/*` — needs Gmail OAuth |
| Sponsor integrations (PayPal Agent Toolkit/MCP, AG Grid, Bryntum, APIMatic) | ❌ | 🟡 scoped, each behind a flag | A2A / Cognee dropped as out-of-thesis |
| **PayPal Transaction Search + Balances (Reporting API)** | ❌ | ✅ **live** on `/insights` — real settled txns + account balance (session-gated; labelled "RePal's own account, not your wallet") | `lib/paypal/reporting`, `app/api/paypal/transactions` |

Legend: ✅ done · 🟡 partial · ❌ not started.

---

## The signature PRD beats — now real

- **"The mandate IS a PayPal Vault token."** Real setup-token → buyer approval →
  payment-token exchange; the token id is stored on the mandate and the mandate
  is re-signed to bind it. Enforced by a signed, tamper-evident policy.
- **"PayPal moves money across the whole lifecycle."** OIDC · Vault · Orders
  (mandate-gated) · Payouts (reward liberation) · Refunds · webhooks — all wired.
- **"The agent acts within delegated authority."** It settles policy-`allow`
  plans via the Vault token (no redirect), and bounces `ask`/`deny` to the human.
  The approval threshold is the human-in-the-loop boundary.
- **Every money action yields a verifiable receipt** at `/verify/:id`
  (Ed25519-signed); `/insights` aggregates them.

---

## Shipped this cycle (6 phases, each PR → tests → deploy → Discord)

1. **P1** — Real PayPal Vault mandate (backend + `/mandate` UI). _Verified live._
2. **P2** — Server-side mandate enforcement before capture. _Verified live
   (deny / ask / approved)._
3. **P3** — Payouts connected (reward→cash), persisted + verifiable.
4. **P4** — Agent money tools (`pay` / `payout` / `grant_mandate`).
5. **P5** — Expiry scan implemented + scheduled (daily).
6. **P6** — Refund persistence + webhooks acting on events.
7. **P8** — Self-contained insights dashboard.

Plus a real bug the new gate caught and fixed (the seeded demo mandate was
unsigned → correctly rejected → re-signed with the production key). 3 DB
migrations applied to Neon.

---

## Remaining to PRD-complete (~20%) — all gated on external accounts, not engineering

1. **Real Gmail ingestion (P7)** — needs a Google Cloud OAuth app
   (`GOOGLE_CLIENT_ID` / `SECRET`). Ingestion stays mock (labelled) until then.
2. **Sponsor integrations** — one PR each, each behind an env flag: **PayPal
   Agent Toolkit / MCP** (on-thesis), **AG Grid** insights, **Bryntum** timeline,
   **APIMatic** SDK/docs. A2A / Cognee dropped as out-of-thesis for the deadline.
3. **Two live-demo gates (not code):**
   - **Bedrock use-case form** (AWS console) — optional; the app runs Gemini-first
     today, so AI is live regardless.
   - **US sandbox business account** — only needed for *real* Payouts. The reward
     cash-out now degrades to an **honest simulated payout** (real signed receipt,
     labelled "sandbox · simulated") when the IN sandbox sender is restricted, so
     the demo completes end-to-end either way.
4. **Minor:** `/api/runs/:id/approve` pause-resume (deferred — the threshold
   handles approval today). _(PayPal Transaction Search + Balances now shipped.)_

---

## Recommendation for the deadline

Depth over breadth. The differentiating core is done. With the time left,
prioritise: (1) make the hero demo flawless and record it, (2) clear the two
live gates (Bedrock form + US sandbox account) so the signature beats are real
on camera, (3) only then add PayPal Agent Toolkit/MCP. Skip the other sponsor
integrations.

---

# Competitive benchmark & win prediction

_"Build What's Next with PayPal and AI" — $69,750 total prizes, ~global field._

## The one non-negotiable requirement
> The project must **meaningfully use both PayPal and AI.** A working/runnable
> demo, a public repo with a license, and a <3-min video are mandatory.

Everything else (creativity, impact, execution, polish) is secondary scoring —
but a project that doesn't *meaningfully* use PayPal is effectively out,
regardless of how good its AI is.

## Technical winning case: PayPal API breadth × agentic AI

The judges reward *meaningful* PayPal + AI. RePal's technical edge is that it
uses **~9 distinct PayPal products as one coherent money loop** — far beyond the
single-API (Checkout/Orders) integration most entries will ship:

| PayPal product | How RePal uses it | File |
|---|---|---|
| **Log in with PayPal (OIDC) + Identity** | identity / sign-in | `app/api/auth/paypal/*` |
| **Vault v3 (setup + payment tokens)** | the **delegated-authority mandate** the agent spends against | `lib/paypal/vault` |
| **Orders v2 (create + capture)** | mandate-gated pay-in, incl. agent-initiated `vault_id` (no redirect) | `lib/paypal/orders` |
| **Agent-selected funding** (Orders `payment_source`) | the agent *chooses how* to pay — instant balance / **Venmo** / **Pay Later** — deterministically, with a one-tap override | `lib/paypal/funding`, `app/api/pay/order` |
| **Payouts** | **reward→cash liberation** (the signature beat); honest simulated fallback when the IN sandbox sender is restricted | `lib/paypal/payouts`, `lib/payout/liberate` |
| **Refunds** | reversal + signed reversal receipt | `lib/paypal/refunds` |
| **Webhooks (signature-verified)** | drive downstream Payout/Refund status | `app/api/webhooks/paypal` |
| **Transaction Search (Reporting API)** | live settled-transaction history on `/insights` | `lib/paypal/reporting` |
| **Balances (Reporting API)** | live account balance KPI on `/insights` | `lib/paypal/reporting` |

On the AI side: an agentic **ToolLoopAgent** (AI SDK) on Bedrock Claude whose
tools are a **deterministic** `lib/` layer, with a hard invariant — **the LLM
never computes money** — plus a grounding guard that rejects any T&C number not
verbatim in the source. The trust story is cryptographic: **Ed25519-signed
mandates and receipts**, a server-side policy re-gate before every capture, and
public verification at `/verify/:id`.

This is the "what's next with PayPal + AI" the brief asks for: an agent that
**acts on money within signed, enforced, revocable authority** — not a chatbot
bolted onto a checkout button.

## RePal scorecard (honest)

| Criterion | Grade | Notes |
|---|---|---|
| PayPal depth | **A** | Likely top-decile — most entries use *one* API (Checkout/Orders); RePal uses the whole money lifecycle incl. **delegated Vault authority + Payouts**. This is the strongest differentiator. |
| AI meaningfulness | **A-** | A real agent that *acts* on money within signed, enforced limits; the "LLM never computes money" boundary is a mature, demo-able idea. |
| Originality / "what's next" | **A-** | Agentic **rewards→cash liberation under a Vault mandate** is a genuinely novel payment experience — exactly the "new ways to pay/get paid" the brief asks for. |
| Impact / narrative | **B+** | Real consumer pain (stuck gift cards/points); clear story. |
| Execution / polish | **A-** | Deployed, CI/CD, monitoring, verifiable Ed25519 receipts, polished UI. |
| PayPal breadth (APIs used) | **A+** | ~9 PayPal products across the money loop + reporting (Txn Search, Balances) + agent-selected funding — far beyond the single-API norm. |
| Sponsor-tool use | **B+** | Uses **Channel3** (a listed sponsor) for discovery. |
| Demo readiness | **B+** | Both former gates mitigated: AI runs Gemini-first (no Bedrock dependency), and reward→cash completes via an honest **simulated payout** when the IN sandbox sender is restricted. A US sandbox business account is still needed only for a *real* on-chain-of-money payout. |

## Win prediction (calibrated — not hype)

- **Grand/overall prize:** **low** for *any* single entry in a large global field —
  realistically a long shot that hinges on narrative + a flawless demo + luck.
- **A special / category award** (e.g. best use of PayPal, execution, creativity,
  new payment experience): **genuinely competitive — this is RePal's real target.**
  The full-lifecycle PayPal usage + the mandate→agent→reward-liberation story is
  exactly what a "best PayPal use" judge rewards.
- **Table stakes** (eligible, functional, documented, public repo + license,
  video): **already essentially met** once the demo video exists.

**Biggest single lever on the odds:** a crisp **<3-min demo video** showing the
signature beats *actually working* — which requires clearing the two live gates
first. Right now the risk isn't the build; it's that the on-camera demo of
"agent pays via mandate" and "reward → real cash" would stall on the Bedrock
form and the India-sender Payout restriction. Fix those two and record, and
RePal moves from "strong, gated" to "strong, proven."

**Bottom line:** against AI-only projects like MiroFish, RePal wins the
eligibility axis outright. Its realistic ceiling is a **special/category award**,
contingent almost entirely on demo execution in the final days — not on more
features.
