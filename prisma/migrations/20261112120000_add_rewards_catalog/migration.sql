-- Cold-start rewards catalog (additive, non-destructive).

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "countries" TEXT[],
    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogOffer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "network" TEXT,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minSpendUsd" DOUBLE PRECISION,
    "maxRewardUsd" DOUBLE PRECISION,
    "audience" TEXT NOT NULL,
    "termsRaw" TEXT NOT NULL,
    "rules" JSONB,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CatalogOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_domain_key" ON "Merchant"("domain");

-- AlterTable (additive columns; existing rows get defaults)
ALTER TABLE "User"
    ADD COLUMN "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "country" TEXT NOT NULL DEFAULT 'US',
    ADD COLUMN "gmailLinked" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "cardLinked" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- AlterTable (nullable; existing rewards unaffected)
ALTER TABLE "Reward"
    ADD COLUMN "offerId" TEXT,
    ADD COLUMN "merchantId" TEXT,
    ADD COLUMN "savedBy" TEXT;

-- AddForeignKey
ALTER TABLE "CatalogOffer" ADD CONSTRAINT "CatalogOffer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
