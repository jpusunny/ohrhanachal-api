-- Wholesale portal: per-variant wholesale prices, wholesale accounts, channel on Order.

CREATE TYPE "OrderChannel" AS ENUM ('web', 'wholesale', 'phone');
CREATE TYPE "WholesaleStatus" AS ENUM ('pending', 'approved', 'suspended');

ALTER TABLE "Variant" ADD COLUMN "wholesalePriceCents" INTEGER;

ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'web';
ALTER TABLE "Order" ADD COLUMN "wholesaleAccountId" TEXT;

CREATE TABLE "WholesaleAccount" (
  "id"            TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "passwordHash"  TEXT NOT NULL,
  "businessName"  TEXT NOT NULL,
  "contactName"   TEXT NOT NULL,
  "phone"         TEXT,
  "taxId"         TEXT,
  "shipStreet"    TEXT,
  "shipStreet2"   TEXT,
  "shipCity"      TEXT,
  "shipState"     TEXT,
  "shipZip"       TEXT,
  "shipCountry"   TEXT DEFAULT 'United States',
  "status"        "WholesaleStatus" NOT NULL DEFAULT 'pending',
  "approvedAt"    TIMESTAMP(3),
  "approvedBy"    TEXT,
  "internalNotes" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WholesaleAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleAccount_email_key" ON "WholesaleAccount"("email");
CREATE INDEX "WholesaleAccount_status_idx" ON "WholesaleAccount"("status");
CREATE INDEX "Order_wholesaleAccountId_idx" ON "Order"("wholesaleAccountId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_wholesaleAccountId_fkey"
  FOREIGN KEY ("wholesaleAccountId") REFERENCES "WholesaleAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
