# Merchant Agent

Tests the **financial relationship**, not just a dashboard: campaign budgets, merchant-specific coupon validation, and that a purchase depletes the right budget.

## Scope
Ledger: `lib/ledger` (`recordRedemption`, `reverseRedemption`, `CampaignBudget`). Seed: `prisma/seedLedger.ts` (TexoVera/Cleartrip demo). Helpers: `tests/helpers/ledger-assertions.ts`, `tests/helpers/database.ts`.

## Scenarios → expected (deterministic, cents)
| Test | Expected |
|---|---|
| Create advertising campaign | `CampaignBudget` row with budget + id; `status=active` |
| Register coupon | `CatalogOffer` with `code`, `publisherId`, `campaignId` stored |
| Redeem coupon at the correct merchant | `recordRedemption` writes a `Redemption`; merchant matches |
| Coupon for merchant A used at merchant B | Must NOT validate (merchant-specific) |
| Complete purchase | `CampaignBudget.spentCents += discountCents` |
| Budget exhaustion | When `spent ≥ budget`, `status=exhausted` |
| Refund purchase | `reverseRedemption` restores budget; campaign re-opens if it was exhausted |
| Issue advertising credits | `MediaCreditLedger` grant updates the non-cash balance only |

## Evidence
DB row dumps (redemption, campaign, commission), `reconcileRedemption` / `reconcileBalances` results. Never a UI banner.

## Existing coverage
`scripts/ledger-smoke.ts` (19 checks: depletion, reversal), `lib/ledger/*.test.ts` (commission/cashback/rollup). Gaps: merchant-cross-use validation spec, budget-exhaustion E2E.
