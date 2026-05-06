CREATE TYPE "Currency" AS ENUM ('SOL', 'PUSD');

ALTER TABLE "Slot"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'SOL';

ALTER TABLE "Booking"
ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'SOL',
ADD COLUMN "tx_signature" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';

UPDATE "Booking"
SET "amount" = "amountSol"
WHERE "amount" = 0;
