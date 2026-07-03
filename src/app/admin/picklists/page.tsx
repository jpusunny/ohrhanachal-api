import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

// Batch picklist for the day: every unshipped paid order (by default) with lines
// aggregated by SKU so a picker walks the shelves once. Shows the SKU-total up
// top and a per-SKU order breakdown beneath so items can be sorted by order into
// packing lanes after picking.

function parseDate(s: string | undefined): { start: Date; end: Date; label: string } {
  const today = new Date();
  const iso = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : today.toISOString().slice(0, 10);
  const start = new Date(iso + "T00:00:00Z");
  const end   = new Date(iso + "T23:59:59.999Z");
  return { start, end, label: iso };
}

export default async function BatchPicklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const scope     = typeof sp.scope === "string" ? sp.scope : "unshipped";
  const { start: _s, end, label } = parseDate(dateParam);

  const where = scope === "day"
    ? { placedAt: { gte: _s, lte: end }, status: { in: ["paid" as const, "pending" as const] } }
    : { status: "paid" as const, placedAt: { lte: end } };

  const orders = await prisma.order.findMany({
    where,
    include: { lines: true },
    orderBy: { placedAt: "asc" },
  });

  type Agg = { sku: string; title: string; variant: string; qty: number; per: { orderNo: string; qty: number }[] };
  const bySku = new Map<string, Agg>();
  for (const o of orders) {
    for (const l of o.lines) {
      const cur = bySku.get(l.snapshotSku) || {
        sku: l.snapshotSku, title: l.snapshotTitle, variant: l.snapshotVariantName,
        qty: 0, per: [],
      };
      cur.qty += l.quantity;
      cur.per.push({ orderNo: o.orderNo, qty: l.quantity });
      bySku.set(l.snapshotSku, cur);
    }
  }
  const rows = Array.from(bySku.values()).sort((a, b) => a.title.localeCompare(b.title));
  const totalItems = rows.reduce((n, r) => n + r.qty, 0);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          header, .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <PrintBar dateLabel={label} scope={scope} orderCount={orders.length} skuCount={rows.length} itemCount={totalItems} />

      <div className="bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-800">Ohr Hanachal Press</div>
            <div className="mt-1 text-2xl font-semibold">Batch Picklist</div>
            <div className="text-sm text-gray-600">
              {scope === "day" ? `Orders placed ${label}` : `All unshipped paid orders as of ${label}`}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <div className="text-3xl font-bold">{orders.length}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500">orders</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{rows.length}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500">unique SKUs</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalItems}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500">total items</div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            No orders match this filter. Try a different date or change the scope above.
          </p>
        ) : (
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="p-2">Qty</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Title</th>
                <th className="p-2">Variant</th>
                <th className="p-2">Split across orders</th>
                <th className="p-2 text-center w-16">Done ✓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sku} className="border-b border-gray-300">
                  <td className="p-2 text-2xl font-bold">×{r.qty}</td>
                  <td className="p-2 font-mono">{r.sku}</td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2 text-gray-700">
                    {r.variant && r.variant !== "Default" ? r.variant : ""}
                  </td>
                  <td className="p-2 text-xs text-gray-600">
                    {r.per.map((p, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        <span className="font-mono">{p.orderNo}</span>×{p.qty}
                      </span>
                    ))}
                  </td>
                  <td className="p-2 text-center">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="no-print mt-4 text-sm">
        <Link href="/admin/orders" className="text-gray-600 hover:underline">← Back to orders</Link>
      </div>
    </>
  );
}
