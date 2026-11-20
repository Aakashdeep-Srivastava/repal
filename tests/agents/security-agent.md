# Security & Fraud Agent

Attacks the commercial ledger, authorization, replay protection, and amount integrity. **All financial authorization must be enforced server-side** — never trust the client.

## Scenarios → expected
| Attack | Expected |
|---|---|
| Redeem same one-time coupon twice | 2nd rejected (`RedemptionError:"already_redeemed"`) |
| Two simultaneous redemptions of a one-time coupon | Exactly one succeeds (atomic txn) |
| Present a wrong coupon code | Rejected (`RedemptionError:"invalid_code"`) |
| Use an expired offer | Rejected by eligibility |
| Change discount amount in the browser | Server uses plan numbers / gate; manipulated client amount ignored |
| Use another user's coupon / read another user's wallet | Access denied / scoped to session |
| Replay a capture request | No duplicate capture / duplicate receipt |
| Replay / duplicate webhook | Idempotent (`WebhookEvent.id` upsert; effects once) |
| Exceed mandate cap/budget | `gateSpend` → deny |
| Tamper with a signed receipt | `verifyReceipt` fails |
| Withdraw media credits | Not permitted |

## Known defects to encode as tests (from code review)
- `one_time_use` — now ENFORCED in `recordRedemption`; keep the double-redeem + concurrent test as regression guards.
- Capture assumes `captures[0].id` with no status check — encode a `PARTIALLY_COMPLETED`/`DECLINED` test (currently expected to FAIL until multi-seller/robust capture lands → QA finding F2).

## Rules
Determinism only; isolated attacker user (`qa-sec-` prefix). Report each failure with URL, API response, request id, and severity. Do NOT weaken a test to pass.

## Existing coverage
`lib/policy/*.test.ts` (mandate deny), `lib/receipts/*.test.ts` (tamper), `scripts/ledger-smoke.ts` (double-redeem, invalid code). Gaps: concurrent-redemption, cross-user wallet, duplicate-webhook, amount-manipulation specs.
