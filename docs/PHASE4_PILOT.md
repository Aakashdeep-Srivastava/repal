# Phase 4 — Commercial Pilot Kit

_Created 2026-11-21. The onboarding runbook + partner integration contract for RePal's first commercial pilot. Phase 4 of the frozen roadmap in [`PRODUCT_SCOPE.md §3`](./PRODUCT_SCOPE.md). Builds on Phase 3's merchant-confirmed redemption ([`lib/redemption/`](../lib/redemption))._

---

## 0. What is and isn't done

**Done (engineering, live):** the complete pilot loop — publisher inventory → campaign budget → redemption → **merchant/affiliate confirmation over real HTTP** → gated settlement → campaign reporting. Every line of the real-network path runs end-to-end, proven by `scripts/phase4-pilot-smoke.ts` (13/13 checks) against a **running reference partner**.

**Not done (needs a real partner — the actual Phase 4 gate):** a *signed* merchant or affiliate network. The reference partner (`lib/partner-ref/`, `/api/partner-ref`) is a **labelled deterministic stand-in** — it proves the plumbing, it does **not** prove real partner economics. Real redemption rates, incremental-sales lift, and merchant ROI can only be measured once a real partner is confirming real redemptions. **Do not present reference-partner numbers as real economics.**

---

## 1. The integration contract (what a partner implements)

RePal's `AffiliateHttpAdapter` ([`lib/redemption/affiliate.ts`](../lib/redemption/affiliate.ts)) calls the partner's host. Point `AFFILIATE_API_URL` at their base URL; they implement three `POST` endpoints under it, bearer-authenticated with `AFFILIATE_API_KEY`:

### `POST {base}/redemptions/validate`
Request: `{ code, offerId, merchantId }` → Response: `{ valid: boolean, normalizedCode?: string, reason?: string }`

### `POST {base}/redemptions/confirm`
The authoritative handshake. Request: `{ redemptionId, code, offerId, merchantId, netPaidCents }` → Response:
```json
{ "confirmed": true, "reference": "<partner confirmation id>" }
```
or `{ "confirmed": false, "reason": "merchant_declined" }`. **Only a `confirmed: true` with a `reference` makes the commission payable.** RePal never infers confirmation.

### `POST {base}/redemptions/reverse`
Request: `{ redemptionId, confirmationRef, merchantId, reason }` → Response: `{ ok: true }` (any 2xx acknowledges).

A partner that returns non-2xx, times out, or is unreachable yields a **non-confirmation** — never a false positive. See the reference implementation in [`lib/partner-ref/handler.ts`](../lib/partner-ref/handler.ts); it is the exact shape a real partner swaps in for.

---

## 2. Env wiring

| Var | Meaning |
|---|---|
| `AFFILIATE_API_URL` | Partner base URL. **Set → RePal uses the real adapter** (`hasRealRedemptionNetwork()` true); unset → the labelled sandbox adapter. |
| `AFFILIATE_API_KEY` | Bearer token RePal presents to the partner. |
| `AFFILIATE_NETWORK` | Short name → adapter `source` = `affiliate:<name>` (stored on the redemption). |
| `PARTNER_REF_API_KEY` | Enables the bundled **reference** partner at `/api/partner-ref` (pilot/testing only). Unset → that endpoint 404s. |

To dry-run against the bundled reference partner: set `AFFILIATE_API_URL={self}/api/partner-ref`, `AFFILIATE_API_KEY={same as PARTNER_REF_API_KEY}`, `AFFILIATE_NETWORK=refpilot`.

---

## 3. Onboarding runbook (one publisher + 1–2 merchants)

All writes are additive ledger rows — no schema change. Do it on a dev branch first, then prod with approval.

1. **Publisher** — `Publisher` row (id, name, kind).
2. **Agreement** — `PartnerAgreement` (publisherId, merchantId|null, `repalFeeBps`, `revShareBps`). Merchant-specific beats global.
3. **Campaign** — `CampaignBudget` (merchantId, `budgetCents` for discount funding, optional `mediaCreditCents`).
4. **Offers** — `CatalogOffer` rows (code, publisherId, campaignId, type/value, `stackable`, `rules`). `seedLedger.ts` is the worked example.
5. **Confirmation** — stand up the partner's `/redemptions/*` host, set the env above.
6. **Settlement** — `markPayable` advances only **confirmed** redemptions; publisher commission + customer cashback become `payable`. The PayPal payout-of-commission is still US-sender-gated (see [`paypal-sandbox-facts`]).

---

## 4. What the pilot measures (reporting)

`GET /api/insights/campaigns` ([`lib/ledger/campaign-report.ts`](../lib/ledger/campaign-report.ts)) returns per campaign, from the live ledger:

- budget / spent / remaining (discount funding)
- redemptions **recorded vs merchant-confirmed**, and the confirmation rate
- **confirmed GMV** and discount given
- cash commission (RePal net + publisher payable)
- **separate** balances the roadmap forbids combining: customer cashback liability, non-cash media credits

> **Honesty:** `confirmationRate` is confirmed ÷ recorded, **not** a true redemption rate (that needs distribution/impression data RePal doesn't yet collect). Any ROI derived from pilot numbers must be labelled against the reference partner until a real partner is live.

---

## 5. Success criteria (when Phase 4 is really done)

One real publisher + 1–2 real merchants, and **one verified real redemption confirmed by the real partner** producing **one positive commercial cycle** (commission earned on confirmed GMV, within campaign budget, with separate media-credit and cashback accounting). That result — not more features — is what proves the business. See [`PRODUCT_SCOPE.md §6`](./PRODUCT_SCOPE.md).
