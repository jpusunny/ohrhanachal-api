import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  initial: "Initial",
  manual_adjustment: "Manual",
  order: "Order",
  return: "Return",
  correction: "Correction",
};

const REASON_COLOR: Record<string, string> = {
  initial: "bg-blue-100 text-blue-800",
  manual_adjustment: "bg-yellow-100 text-yellow-800",
  order: "bg-purple-100 text-purple-800",
  return: "bg-green-100 text-green-800",
  correction: "bg-orange-100 text-orange-800",
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const reason = typeof sp.reason === "string" ? sp.reason : "all";
  const limit = 100;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(reason !== "all" && ["initial", "manual_adjustment", "order", "return", "correction"].includes(reason)
        ? { reason: reason as "initial" | "manual_adjustment" | "order" | "return" | "correction" }
        : {}),
      ...(q
        ? {
            OR: [
              { note: { contains: q, mode: "insensitive" as const } },
              { actor: { contains: q, mode: "insensitive" as const } },
              { variant: { sku: { contains: q, mode: "insensitive" as const } } },
              { variant: { product: { title: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      variant: {
        include: { product: { select: { id: true, title: true, handle: true } } },
      },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock movements</h1>
        <Link
          href="/admin/products"
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to products
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search product, SKU, actor, note…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm min-w-[240px]"
        />
        <select name="reason" defaultValue={reason} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All reasons</option>
          <option value="initial">Initial</option>
          <option value="manual_adjustment">Manual adjustment</option>
          <option value="order">Order fulfillment</option>
          <option value="return">Return</option>
          <option value="correction">Correction</option>
        </select>
        <button type="submit" className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">Apply</button>
      </form>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Product / Variant</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No stock movements match those filters.
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {m.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${m.variant.product.id}`} className="font-medium hover:underline">
                    {m.variant.product.title}
                  </Link>
                  <div className="text-xs text-gray-500">{m.variant.name}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{m.variant.sku}</td>
                <td className={"px-3 py-2 text-right font-semibold " + (m.delta > 0 ? "text-green-700" : "text-red-700")}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
                <td className="px-3 py-2">
                  <span className={"rounded px-2 py-0.5 text-xs font-medium " + (REASON_COLOR[m.reason] || "bg-gray-100 text-gray-700")}>
                    {REASON_LABEL[m.reason] || m.reason}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{m.actor}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{m.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Showing latest {movements.length}{movements.length === limit && ` (capped at ${limit})`}
      </p>
    </div>
  );
}
