import { prisma } from "@/lib/prisma";
import BulkPriceForm, { type PriceRow } from "./BulkPriceForm";

export const dynamic = "force-dynamic";

export default async function BulkPricePage() {
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    include: { variants: { orderBy: { name: "asc" } } },
  });
  const rows: PriceRow[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      rows.push({
        variantId: v.id,
        productTitle: p.title,
        productHandle: p.handle,
        variantName: v.name,
        sku: v.sku,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents,
        authorGroup: p.authorGroup,
        seforGroup: p.seforGroup,
      });
    }
  }
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Bulk price update</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pick the variants you want to touch, choose a change mode, and preview before applying.
          Prices are stored in cents. Rounding to <code>x.99</code> is common for retail.
        </p>
      </div>
      <BulkPriceForm rows={rows} />
    </div>
  );
}
