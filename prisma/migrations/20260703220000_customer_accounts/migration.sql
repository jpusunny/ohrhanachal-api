-- Retail customer accounts (optional): Customer table + Order.customerId link.

CREATE TABLE "Customer" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "phone"        TEXT,
  "shipStreet"   TEXT,
  "shipStreet2"  TEXT,
  "shipCity"     TEXT,
  "shipState"    TEXT,
  "shipZip"      TEXT,
  "shipCountry"  TEXT DEFAULT 'United States',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
