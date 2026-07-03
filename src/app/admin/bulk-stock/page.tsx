import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BulkStockForm, { type BulkVariantRow } from "./BulkStockForm";

export const dynamic = "force-dynamic";

export default async function BulkStockPage() {
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    include: {
      variants: {
        include: { inventory: true },
        orderBy: { name: "asc" },
      },
    },
  });

  const rows: BulkVariantRow[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      rows.push({
        variantId: v.id,
        productId: p.id,
        productTitle: p.title,
        productHandle: p.handle,
        variantName: v.name,
        sku: v.sku,
        onHand: v.inventory?.onHand ?? 0,
        reserved: v.inventory?.reserved ?? 0,
        reorderPoint: v.inventory?.reorderPoint ?? null,
        authorGroup: p.authorGroup,
        seforGroup: p.seforGroup,
      });
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bulk stock adjustment</h1>
          <p className="mt-1 text-sm text-gray-600">
          Type a positive delta to add stock (e.g. after a print run) or negative to remove.
          Empty rows are ignored. All changes commit as one transaction and share a batch id
          in the audit trail.
          </p>
        </div>
        <Link href="/admin/products" className="whitespace-nowrap text-sm text-gray-600 hover:underline">
          ← Back to products
        </Link>
      </div>
      <BulkStockForm rows={rows} />
    </div>
  );
}
