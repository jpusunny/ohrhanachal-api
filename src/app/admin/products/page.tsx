import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { priceRange } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductsListPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variants: { include: { inventory: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New product
        </Link>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Hebrew</th>
              <th className="px-4 py-3">Formats</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">On hand</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                  No products yet. Click <span className="font-medium">New product</span> to add one.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const prices = p.variants.map((v) => v.priceCents);
              const onHand = p.variants.reduce((sum, v) => sum + (v.inventory?.onHand ?? 0), 0);
              const formats = p.variants.map((v) => v.name).join(", ") || "—";
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right" dir="rtl">
                    {p.titleHe || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formats}</td>
                  <td className="px-4 py-3 text-gray-900">{priceRange(prices)}</td>
                  <td className="px-4 py-3 text-gray-900">{onHand}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === "active"
                          ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          : "rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
