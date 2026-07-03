-- "In our press this month" flag on products. Homepage surfaces these
-- ahead of everything else — meaningful only when the owner has toggled a
-- handful; falls back to the general catalog when the set is empty.

ALTER TABLE "Product" ADD COLUMN "currentlyPrinting" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_currentlyPrinting_idx" ON "Product"("currentlyPrinting");
