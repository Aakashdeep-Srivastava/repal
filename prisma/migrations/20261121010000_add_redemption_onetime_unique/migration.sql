-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "oneTimeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Redemption_oneTimeKey_key" ON "Redemption"("oneTimeKey");

