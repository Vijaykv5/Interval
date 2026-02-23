-- AlterTable
ALTER TABLE "Creator" ADD COLUMN "profileImageUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Creator_wallet_key" ON "Creator"("wallet");
