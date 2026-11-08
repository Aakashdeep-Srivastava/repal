-- Phase 3: persist reward→cash payouts (previously fire-and-forget).
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT,
    "receiptId" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "receiverEmail" TEXT NOT NULL,
    "payoutBatchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");
