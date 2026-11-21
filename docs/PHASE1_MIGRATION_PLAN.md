# Phase 1 — Commercial Ledger Migration Plan (FOR REVIEW)

_Created 2026-11-21 · **Review-only. No production migration has been executed. Awaiting explicit approval.**_

## Summary

Two **additive** Prisma migrations activate the commercial ledger in production. They are already applied on `main` (code) but the DB objects are not yet in prod — so the ledger is currently dormant there.

| # | Migration | Effect |
|---|---|---|
| 7 | `20261121000000_add_commercial_ledger` | Creates **11 new tables** (Publisher, PartnerAgreement, CampaignBudget, Redemption, Attribution, CommissionLedger, MediaCreditLedger, CustomerRewardLedger, PaymentLedger, PayoutBatch, PayoutItem) + **4 nullable columns** on `CatalogOffer` (`code`, `publisherId`, `campaignId`, `stackable DEFAULT true`). All FKs are **within the ledger graph** — no FK or constraint is added to any existing table. 31 indexes. **Zero DROP / ALTER-COLUMN / RENAME.** |
| 8 | `20261121010000_add_redemption_onetime_unique` | Adds nullable `Redemption.oneTimeKey` + a UNIQUE index (atomic one-time-use enforcement). `Redemption` is created empty by migration 7, so the unique index has no existing data to conflict with. |

Full SQL: `prisma/migrations/20261121000000_add_commercial_ledger/migration.sql` (287 lines) and `prisma/migrations/20261121010000_add_redemption_onetime_unique/migration.sql` (below, 6 lines):

```sql
-- 20261121010000_add_redemption_onetime_unique
ALTER TABLE "Redemption" ADD COLUMN "oneTimeKey" TEXT;
CREATE UNIQUE INDEX "Redemption_oneTimeKey_key" ON "Redemption"("oneTimeKey");
```

## Verification results

### A. Read-only production inspection (host `ep-old-tooth-bfz1j75r`, SELECT-only)
- **None** of the 11 ledger tables exist in prod.
- `CatalogOffer` does **not** yet have the 4 new columns.
- `Redemption` table is **absent** → **zero `oneTimeKey` duplicate/conflict risk** (unique index lands on a fresh empty table).
- `_prisma_migrations` = exactly the 6 pre-ledger migrations (through `20261112120000_add_rewards_catalog`) → **`prisma migrate deploy` will apply ONLY migrations 7 + 8.**
- **Prod data baseline:** `User=7, Reward=74, Receipt=10, Merchant=25, CatalogOffer=20, Mandate=5, Payout=0, Refund=0`.

### B. Isolated Neon branch apply test (reproduced prod schema → seeded → applied 7+8)
- Reproduced prod exactly (6 pre-ledger migrations), seeded `Merchant=2`, `CatalogOffer=3`.
- Applied migrations 7 + 8 → **both succeeded.**
- **Data preserved:** `Merchant=2`, `CatalogOffer=3` unchanged.
- **New columns backfilled safely:** all existing `CatalogOffer` rows → `stackable=true`, `code`/`publisherId`/`campaignId`=NULL.
- **11 ledger tables created; `Redemption_oneTimeKey_key` unique index present.**

**Conclusion:** the migration is purely additive, cannot conflict with existing prod data, and preserves all existing rows.

## Backup & recovery (do BEFORE executing on prod)

1. **Snapshot first (recommended):** take a Neon branch/snapshot of the prod branch immediately before migrating → instant restore target. Prod also has point-in-time restore within its history-retention window.
2. **Rollback is clean (additive):** if needed, reverse with the down-SQL below. (Prisma has no auto-down; this is the manual reverse. Safe because all objects are new and empty.)

```sql
-- ROLLBACK (only if required; drops the new, empty ledger objects)
DROP TABLE IF EXISTS "PayoutItem","PayoutBatch","PaymentLedger","CustomerRewardLedger",
  "MediaCreditLedger","CommissionLedger","Attribution","Redemption",
  "CampaignBudget","PartnerAgreement","Publisher" CASCADE;
ALTER TABLE "CatalogOffer"
  DROP COLUMN IF EXISTS "code",
  DROP COLUMN IF EXISTS "publisherId",
  DROP COLUMN IF EXISTS "campaignId",
  DROP COLUMN IF EXISTS "stackable";
-- then remove the two rows from _prisma_migrations if they were recorded.
```

## Execution (⛔ DO NOT RUN until explicitly approved)

With the prod `DATABASE_URL`/`DIRECT_URL` set, from a clean checkout of `main`:

```bash
# Dry-run check: should list exactly the 2 pending migrations (7 + 8)
npx prisma migrate status

# Apply (after snapshot + approval):
npx prisma migrate deploy

# Then seed the ledger reference data (publishers/agreements/campaigns/offers):
npx tsx prisma/seedLedger.ts
```

After apply, re-run the read-only baseline check to confirm the 8 existing-table counts are unchanged and the 11 ledger tables exist.

## Risks & notes
- **Low risk** — additive only, verified, with a clean rollback and a snapshot fallback.
- Running tasks are unaffected until a new deploy; the ledger code already tolerates missing tables (best-effort `recordRedemption`), so there is no rush and no partial-state hazard.
- `seedLedger.ts` seeds **synthetic** demo publishers/campaigns (TexoVera/Cleartrip stand-ins) — clearly labelled, not real partners.

## Status
✅ Reviewed · ✅ Verified (isolated + read-only prod) · ⛔ **Not executed — awaiting explicit approval to run on production.**
