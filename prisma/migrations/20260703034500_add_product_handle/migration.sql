-- Add Product.handle (unique, indexed). Backfill existing rows to their id
-- as a temporary safe-unique value; the catalog backfill script will replace
-- them with the real Shopify handles.

ALTER TABLE "Product" ADD COLUMN "handle" TEXT;

UPDATE "Product" SET "handle" = "id" WHERE "handle" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "handle" SET NOT NULL;

CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
