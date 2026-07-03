import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { priceRange } from "@/lib/format";

export const dynamic = "force-dynamic";

type SortKey = "title" | "priceLow" | "priceHigh" | "stockLow" | "stockHigh";

const SORT_LABEL: Record<SortKey, string> = {
  title: "A → Z",
  priceLow: "Price: low → high",
  priceHigh: "Price: high → low",
  stockLow: "Stock: low → high",
  stockHigh: "Stock: high → low",
};

function moneyish(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "all";
  const sort: SortKey = ((): SortKey => {
    const s = typeof sp.sort === "string" ? sp.sort : "title";
    return ["title", "priceLow", "priceHigh", "stockLow", "stockHigh"].includes(s) ? (s as SortKey) : "title";
  })();
  const lowOnly = sp.low === "1";

  const products = await prisma.product.findMany({
    where: {
      ...(status === "draft" || status === "active" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { titleHe: { contains: q } },
              { handle: { contains: q, mode: "insensitive" as const } },
              { variants: { some: { sku: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
    include: {
      variants: { include: { inventory: true } },
    },
  });

  const rows = products.map((p) => {
    const prices = p.variants.map((v) => v.priceCents);
    const onHand = p.variants.reduce((s, v) => s + (v.inventory?.onHand ?? 0), 0);
    const reserved = p.variants.reduce((s, v) => s + (v.inventory?.reserved ?? 0), 0);
    const available = Math.max(0, onHand - reserved);
    const low = p.variants.some((v) => {
      const rp = v.inventory?.reorderPoint;
      if (rp == null) return false;
      const avail = (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0);
      return avail <= rp;
    });
    const priceMin = prices.length ? Math.min(...prices) : 0;
    const priceMax = prices.length ? Math.max(...prices) : 0;
    return { p, prices, onHand, reserved, available, low, priceMin, priceMax };
  });

  const filtered = lowOnly ? rows.filter((r) => r.low) : rows;

  const sorted = filtered.slice().sort((a, b) => {
    if (sort === "priceLow") return a.priceMin - b.priceMin;
    if (sort === "priceHigh") return b.priceMax - a.priceMax;
    if (sort === "stockLow") return a.available - b.available;
    if (sort === "stockHigh") return b.available - a.available;
    return a.p.title.localeCompare(b.p.title);
  });

  const lowCount = rows.filter((r) => r.low).length;
  const totalCount = rows.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/orders"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Orders
          </Link>
          <Link
            href="/admin/bulk-stock"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Bulk stock
          </Link>
          <Link
            href="/admin/bulk-price"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Bulk price
          </Link>
          <Link
            href="/admin/movements"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Movements
          </Link>
          <Link
            href="/admin/groups"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Groups
          </Link>
          <Link
            href="/admin/import"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Import CSV
          </Link>
          <a
            href="/api/admin/catalog-export"
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
          <Link
            href="/admin/products/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            New product
          </Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search title, Hebrew, handle, SKU…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm min-w-[220px]"
        />
        <select name="status" defaultValue={status} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="draft">Draft only</option>
        </select>
        <select name="sort" defaultValue={sort} className="rounded border border-gray-300 px-3 py-2 text-sm">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>Sort: {SORT_LABEL[k]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} />
          Low stock only
          {lowCount > 0 && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-700">{lowCount}</span>}
        </label>
        <button type="submit" className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">Apply</button>
      </form>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Hebrew</th>
              <th className="px-4 py-3">Series</th>
              <th className="px-4 py-3">Formats</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">On hand</th>
              <th className="px-4 py-3">Avail</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>
                  {q || lowOnly || status !== "all"
                    ? "No products match those filters."
                    : "No products yet. Click New product to add one."}
                </td>
              </tr>
            )}
            {sorted.map(({ p, prices, onHand, reserved, available, low }) => {
              const formats = p.variants.map((v) => v.name).join(", ") || "—";
              return (
                <tr key={p.id} className={"hover:bg-gray-50" + (low ? " bg-red-50/40" : "")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {low && <span title="Low stock" className="h-2 w-2 rounded-full bg-red-500" />}
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500">
                      <span className="font-mono">{p.handle}</span>
                      {p.seforGroup && <> · <span className="font-mono">{p.seforGroup}</span></>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right" dir="rtl">
                    {p.titleHe || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.authorGroup}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formats}</td>
                  <td className="px-4 py-3 text-gray-900">{priceRange(prices)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {onHand}
                    {reserved > 0 && (
                      <div className="text-xs text-gray-500">−{reserved} reserved</div>
                    )}
                  </td>
                  <td className={"px-4 py-3 " + (low ? "text-red-600 font-medium" : "text-gray-900")}>
                    {available}
                  </td>
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

      <p className="mt-3 text-xs text-gray-500">
        Showing {sorted.length} of {totalCount}
        {lowCount > 0 && <> · <span className="text-red-700">{lowCount} low-stock</span></>}
        {" "}· {moneyish(rows.reduce((s, r) => s + r.available * r.priceMin, 0))} inventory value
      </p>
    </div>
  );
}
