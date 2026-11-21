-- Phase 3: merchant/affiliate confirmation on a redemption.
-- Purely additive — three NULLABLE columns, no backfill, no constraints, no drops.
-- Existing rows keep NULL (= not yet merchant-confirmed), which is the correct default:
-- `markPayable` now refuses to settle a commission whose redemption has no `confirmedAt`.
ALTER TABLE "Redemption" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmationSource" TEXT,
ADD COLUMN     "confirmationRef" TEXT;
