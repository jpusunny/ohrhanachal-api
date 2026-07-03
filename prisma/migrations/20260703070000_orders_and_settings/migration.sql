-- Orders (Order + OrderLine + OrderEvent), Setting (KV for admin config).
-- Sequence-backed orderNo makes for human-readable "OH-123456" numbers.

CREATE TYPE "OrderStatus" AS ENUM ('pending','paid','shipped','delivered','cancelled');
CREATE TYPE "PaymentPref" AS ENUM ('contact_me','invoice','phone','in_person');
CREATE TYPE "OrderEventKind" AS ENUM ('placed','paid','shipped','delivered','cancelled','note');

CREATE SEQUENCE order_no_seq START 100001;

CREATE TABLE "Order" (
  "id"                TEXT NOT NULL,
  "orderNo"           TEXT NOT NULL,
  "status"            "OrderStatus" NOT NULL DEFAULT 'pending',
  "paymentPref"       "PaymentPref" NOT NULL,
  "customerEmail"     TEXT NOT NULL,
  "customerName"      TEXT NOT NULL,
  "customerPhone"     TEXT,
  "shipStreet"        TEXT NOT NULL,
  "shipStreet2"       TEXT,
  "shipCity"          TEXT NOT NULL,
  "shipState"         TEXT NOT NULL,
  "shipZip"           TEXT NOT NULL,
  "shipCountry"       TEXT NOT NULL DEFAULT 'United States',
  "customerNote"      TEXT,
  "internalNote"      TEXT,
  "subtotalCents"     INTEGER NOT NULL,
  "shippingCents"     INTEGER NOT NULL DEFAULT 0,
  "totalCents"        INTEGER NOT NULL,
  "trackingCarrier"   TEXT,
  "trackingNumber"    TEXT,
  "paymentRecordedAs" TEXT,
  "placedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt"            TIMESTAMP(3),
  "shippedAt"         TIMESTAMP(3),
  "deliveredAt"       TIMESTAMP(3),
  "cancelledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
CREATE INDEX "Order_placedAt_idx" ON "Order"("placedAt");

CREATE TABLE "OrderLine" (
  "id"                  TEXT NOT NULL,
  "orderId"             TEXT NOT NULL,
  "variantId"           TEXT NOT NULL,
  "quantity"            INTEGER NOT NULL,
  "unitPriceCents"      INTEGER NOT NULL,
  "lineTotalCents"      INTEGER NOT NULL,
  "snapshotTitle"       TEXT NOT NULL,
  "snapshotSku"         TEXT NOT NULL,
  "snapshotHandle"      TEXT NOT NULL,
  "snapshotVariantName" TEXT NOT NULL,
  "snapshotImageUrl"    TEXT,
  CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderLine_orderId_fkey"   FOREIGN KEY ("orderId")   REFERENCES "Order"("id")   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OrderLine_orderId_idx"   ON "OrderLine"("orderId");
CREATE INDEX "OrderLine_variantId_idx" ON "OrderLine"("variantId");

CREATE TABLE "OrderEvent" (
  "id"        TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "kind"      "OrderEventKind" NOT NULL,
  "actor"     TEXT NOT NULL,
  "body"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

CREATE TABLE "Setting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
