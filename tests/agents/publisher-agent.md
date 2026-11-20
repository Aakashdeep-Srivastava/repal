# Publisher & Attribution Agent

Verifies that the publisher who distributed an offer is correctly attributed and earns its contractual revenue share — and that non-cash media credits are never treated as cash.

## Scope
`lib/ledger`: `Attribution`, `CommissionLedger`, `PartnerAgreement`, `MediaCreditLedger`, `computeCommission`. Seed: `prisma/seedLedger.ts` (gpay 8%/25%, repal-mail 6%/15%).

## Scenarios → expected (deterministic, cents)
| Test | Expected |
|---|---|
| Redeem a gpay-distributed offer | `Attribution{publisherId:"gpay", model:"coupon_code"}` written |
| Commission split | `repalFee = feeBps·netPaid`; `publisherCut = revShareBps·repalFee` (floored); publisher ≤ RePal fee |
| No publisher | RePal earns `DEFAULT_REPAL_FEE_BPS`; publisher share 0; no `party:"publisher"` row |
| Merchant-specific vs global agreement | Merchant-specific agreement wins |
| Refund | Publisher commission reversed if `pending`/`payable`; a `paid` entry is NOT reversed |
| Media credit grant | Increases `MediaCreditLedger` balance only — never the cashback or commission balance |
| Withdraw media credit as cash | NOT permitted (no payout path from media credits) |

## Evidence
`reconcileRedemption({publisherCommissionCents, repalNetCents})`, `reconcileBalances({mediaCreditCents, commissionPayableCents})`.

## Existing coverage
`scripts/ledger-smoke.ts` (attribution, split 40c/120c, reversal), `lib/ledger/commission.test.ts`, `lib/ledger/balances.test.ts` (media-credit netting, publisher-only payable). Gap: media-credit-withdrawal negative test.
