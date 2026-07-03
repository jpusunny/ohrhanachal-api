import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", paid: "Paid", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  paid:      "bg-blue-100 text-blue-800",
  shipped:   "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-700",
};

function money(cents: number) { return "$" + (cents / 100).toFixed(2); }

export default async function OrdersListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "all";

  const validStatus = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
  const orders = await prisma.order.findMany({
    where: {
      ...(validStatus.includes(status as (typeof validStatus)[number])
        ? { status: status as (typeof validStatus)[number] }
        : {}),
      ...(q
        ? {
            OR: [
              { orderNo: { contains: q, mode: "insensitive" as const } },
              { customerEmail: { contains: q, mode: "insensitive" as const } },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerPhone: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { placedAt: "desc" }],
    take: 200,
  });

  const counts: Record<string, number> = {};
  for (const s of validStatus) {
    counts[s] = await prisma.order.count({ where: { status: s } });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/admin/products" className="text-sm text-gray-600 hover:underline">
          ← Back to products
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["all", "All", orders.length + 0], ...validStatus.map((s) => [s, STATUS_LABEL[s], counts[s]] as const)].map(
          ([key, label, n]) => (
            <Link
              key={String(key)}
              href={String(key) === "all" ? "/admin/orders" : `/admin/orders?status=${key}`}
              className={
                "rounded px-3 py-1 text-sm " +
                (status === String(key) || (status === "all" && String(key) === "all")
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
            >
              {label}{typeof n === "number" && n > 0 && <span className="ml-1 opacity-70">({n})</span>}
            </Link>
          ),
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search order #, customer email/name/phone…"
          className="flex-1 min-w-[240px] rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">Search</button>
      </form>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Order #</th>
              <th className="px-3 py-2">Placed</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Payment pref</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No orders here. Placed orders appear at the top with status <em>pending</em>.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.orderNo}</Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                  {o.placedAt.toISOString().replace("T", " ").slice(0, 16)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-xs text-gray-500">{o.customerEmail}{o.customerPhone && ` · ${o.customerPhone}`}</div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {prefShort(o.paymentPref)}
                </td>
                <td className="px-3 py-2 text-right font-medium">{money(o.totalCents)}</td>
                <td className="px-3 py-2">
                  <span className={"rounded px-2 py-0.5 text-xs font-medium " + STATUS_COLOR[o.status]}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function prefShort(p: string): string {
  return {
    contact_me: "Contact for details",
    invoice: "Invoice",
    phone: "Phone card",
    in_person: "Pay on pickup",
  }[p] || p;
}
