-- Phase 6: persist refunds (reversals) so webhooks can update their status.
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "receiptId" TEXT,
    "refundId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Refund_userId_idx" ON "Refund"("userId");
CREATE INDEX "Refund_refundId_idx" ON "Refund"("refundId");
