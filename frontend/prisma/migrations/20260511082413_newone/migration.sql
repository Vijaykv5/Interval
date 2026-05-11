-- CreateTable
CREATE TABLE "KiraPayment" (
    "id" TEXT NOT NULL,
    "customOrderId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "receiverWallet" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "checkoutCode" TEXT,
    "originalPrice" INTEGER NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerStatus" TEXT,
    "bookingId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KiraPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCreditBalance" (
    "wallet" TEXT NOT NULL,
    "creditBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "lifetimeTopupCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCreditBalance_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "DodoTopup" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkoutUrl" TEXT,
    "amountUsdCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT,
    "providerStatus" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DodoTopup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KiraPayment_customOrderId_key" ON "KiraPayment"("customOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "DodoTopup_checkoutSessionId_key" ON "DodoTopup"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DodoTopup_paymentId_key" ON "DodoTopup"("paymentId");

-- CreateIndex
CREATE INDEX "DodoTopup_wallet_createdAt_idx" ON "DodoTopup"("wallet", "createdAt");
