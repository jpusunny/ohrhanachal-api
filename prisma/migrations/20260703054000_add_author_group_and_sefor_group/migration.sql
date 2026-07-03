-- AuthorGroup enum + Product.authorGroup + Product.seforGroup
-- (seforGroup groups format-variants of the same sefer, e.g. all Likutei
-- Moharan / Set / Pocket / Leather rows share seforGroup="likutei-moharan".)

CREATE TYPE "AuthorGroup" AS ENUM ('nachman','nossen','anash','set','other');

ALTER TABLE "Product"
  ADD COLUMN "authorGroup" "AuthorGroup" NOT NULL DEFAULT 'other',
  ADD COLUMN "seforGroup" TEXT;

CREATE INDEX "Product_authorGroup_idx" ON "Product"("authorGroup");
CREATE INDEX "Product_seforGroup_idx" ON "Product"("seforGroup");
