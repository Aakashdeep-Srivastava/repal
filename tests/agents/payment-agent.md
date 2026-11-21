# PayPal & Financial Reconciliation Agent

**Highest financial priority.** Must independently verify money against DB records and PayPal Sandbox responses. **Never accepts a green UI message as proof of settlement.**

## Scope
`lib/paypal/{orders,vault,payouts,refunds,webhooks,reporting}`, `lib/receipts`, `lib/ledger` (`PaymentLedger`). Routes: `/api/pay/{order,capture,refund,payout}`, `/api/webhooks/paypal`, `/api/receipts/[id]`. Helpers: `tests/helpers/paypal.ts`, `ledger-assertions.ts`.

## Independent verifications (deterministic)
| Check | Expected |
|---|---|
| Order amount = authorized amount | equal |
| Captured amount = expected payable (`plan.cashUsd`) | equal, to the cent |
| Capture id = persisted `Receipt.paypalCaptureId` | equal |
| Capture response status | inspect per-unit status; detect `PARTIALLY_COMPLETED`/`DECLINED` (do NOT assume `captures[0]` success) |
| Webhook (verified) → state | correct transition; **duplicate webhook → no double accounting** (idempotent on `WebhookEvent.id`) |
| Refund | correct reversal entry; `reverseRedemption` unwinds commission/cashback |
| Payout | correct recipient/currency/amount — OR clearly-labelled `SIMULATED` when the sandbox sender is restricted (NEVER claim it's a real transfer) |
| Receipt | valid Ed25519 signature (`verifyReceipt`) |
| Ledger totals | `reconcileBalances` matches expected accounting totals |

## Use real sandbox + mocked failures
Real PayPal Sandbox for happy paths; mocked provider responses for deterministic failure/`207` scenarios (multi-seller 207 handling is a KNOWN GAP — see QA finding F2).

## Existing coverage
`e2e/paypal-approval.spec.ts`, `lib/paypal/{funding,toolkit}.test.ts`, `lib/receipts/*.test.ts`, `scripts/ledger-smoke.ts`. Gaps: duplicate-webhook idempotency spec, duplicate-capture spec, 207 handling (unimplemented).
