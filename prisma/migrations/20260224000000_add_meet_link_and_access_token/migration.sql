-- AlterTable
ALTER TABLE "Slot" ADD COLUMN IF NOT EXISTS "meetLink" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
