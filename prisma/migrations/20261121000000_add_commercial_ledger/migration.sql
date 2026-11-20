-- AlterTable
ALTER TABLE "CatalogOffer" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "publisherId" TEXT,
ADD COLUMN     "stackable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "merchantId" TEXT,
    "repalFeeBps" INTEGER NOT NULL,
    "revShareBps" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudget" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "budgetCents" INTEGER NOT NULL,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "mediaCreditCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT,
    "offerId" TEXT,
    "merchantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "receiptId" TEXT,
    "code" TEXT,
    "discountCents" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "netPaidCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'redeemed',
    "reversedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribution" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'last_touch',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "publisherId" TEXT,
    "merchantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payoutItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCreditLedger" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRewardLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redemptionId" TEXT,
    "merchantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "payoutItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRewardLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptId" TEXT,
    "kind" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "sellerMerchantId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "senderBatchId" TEXT NOT NULL,
    "payoutBatchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "receiverEmail" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "commissionId" TEXT,
    "rewardLedgerId" TEXT,
    "payoutItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAgreement_publisherId_idx" ON "PartnerAgreement"("publisherId");

-- CreateIndex
CREATE INDEX "PartnerAgreement_merchantId_idx" ON "PartnerAgreement"("merchantId");

-- CreateIndex
CREATE INDEX "CampaignBudget_merchantId_idx" ON "CampaignBudget"("merchantId");

-- CreateIndex
CREATE INDEX "CampaignBudget_status_idx" ON "CampaignBudget"("status");

-- CreateIndex
CREATE INDEX "Redemption_userId_idx" ON "Redemption"("userId");

-- CreateIndex
CREATE INDEX "Redemption_offerId_idx" ON "Redemption"("offerId");

-- CreateIndex
CREATE INDEX "Redemption_merchantId_idx" ON "Redemption"("merchantId");

-- CreateIndex
CREATE INDEX "Redemption_receiptId_idx" ON "Redemption"("receiptId");

-- CreateIndex
CREATE INDEX "Redemption_status_idx" ON "Redemption"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attribution_redemptionId_key" ON "Attribution"("redemptionId");

-- CreateIndex
CREATE INDEX "Attribution_publisherId_idx" ON "Attribution"("publisherId");

-- CreateIndex
CREATE INDEX "Attribution_merchantId_idx" ON "Attribution"("merchantId");

-- CreateIndex
CREATE INDEX "CommissionLedger_redemptionId_idx" ON "CommissionLedger"("redemptionId");

-- CreateIndex
CREATE INDEX "CommissionLedger_party_idx" ON "CommissionLedger"("party");

-- CreateIndex
CREATE INDEX "CommissionLedger_status_idx" ON "CommissionLedger"("status");

-- CreateIndex
CREATE INDEX "CommissionLedger_merchantId_idx" ON "CommissionLedger"("merchantId");

-- CreateIndex
CREATE INDEX "MediaCreditLedger_merchantId_idx" ON "MediaCreditLedger"("merchantId");

-- CreateIndex
CREATE INDEX "MediaCreditLedger_campaignId_idx" ON "MediaCreditLedger"("campaignId");

-- CreateIndex
CREATE INDEX "CustomerRewardLedger_userId_idx" ON "CustomerRewardLedger"("userId");

-- CreateIndex
CREATE INDEX "CustomerRewardLedger_redemptionId_idx" ON "CustomerRewardLedger"("redemptionId");

-- CreateIndex
CREATE INDEX "CustomerRewardLedger_status_idx" ON "CustomerRewardLedger"("status");

-- CreateIndex
CREATE INDEX "PaymentLedger_userId_idx" ON "PaymentLedger"("userId");

-- CreateIndex
CREATE INDEX "PaymentLedger_receiptId_idx" ON "PaymentLedger"("receiptId");

-- CreateIndex
CREATE INDEX "PaymentLedger_paypalCaptureId_idx" ON "PaymentLedger"("paypalCaptureId");

-- CreateIndex
CREATE INDEX "PaymentLedger_kind_idx" ON "PaymentLedger"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutBatch_senderBatchId_key" ON "PayoutBatch"("senderBatchId");

-- CreateIndex
CREATE INDEX "PayoutItem_batchId_idx" ON "PayoutItem"("batchId");

-- CreateIndex
CREATE INDEX "PayoutItem_purpose_idx" ON "PayoutItem"("purpose");

-- CreateIndex
CREATE INDEX "PayoutItem_status_idx" ON "PayoutItem"("status");

-- CreateIndex
CREATE INDEX "CatalogOffer_publisherId_idx" ON "CatalogOffer"("publisherId");

-- CreateIndex
CREATE INDEX "CatalogOffer_campaignId_idx" ON "CatalogOffer"("campaignId");

-- AddForeignKey
ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CampaignBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRewardLedger" ADD CONSTRAINT "CustomerRewardLedger_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

