-- Add 'card' to PaymentPref enum + Cardknox transaction fields on Order.
ALTER TYPE "PaymentPref" ADD VALUE IF NOT EXISTS 'card';

ALTER TABLE "Order" ADD COLUMN "cardknoxRefNum" TEXT;
ALTER TABLE "Order" ADD COLUMN "cardknoxLast4"  TEXT;
ALTER TABLE "Order" ADD COLUMN "cardknoxBrand"  TEXT;
ALTER TABLE "Order" ADD COLUMN "cardknoxAvsCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "cardknoxCvvCode" TEXT;
