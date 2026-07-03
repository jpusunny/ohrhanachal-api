import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";

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
function ts(d: Date) { return d.toISOString().replace("T", " ").slice(0, 19) + " UTC"; }

const PREF_LABEL: Record<string, string> = {
  contact_me: "Contact me for payment details",
  invoice: "Invoice me (check / wire)",
  phone: "I'll call in with my card",
  in_person: "Pay on pickup / delivery",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { snapshotTitle: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{order.orderNo}</h1>
            <span className={"rounded px-2 py-0.5 text-xs font-medium " + STATUS_COLOR[order.status]}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Placed {ts(order.placedAt)} · {PREF_LABEL[order.paymentPref] || order.paymentPref}
          </p>
        </div>
        <Link href="/admin/orders" className="whitespace-nowrap text-sm text-gray-600 hover:underline">
          ← Back to orders
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {l.snapshotImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.snapshotImageUrl} alt="" className="h-12 w-12 rounded border border-gray-200 object-cover" />
                        )}
                        <div>
                          <Link href={`/admin/products?q=${encodeURIComponent(l.snapshotSku)}`} className="font-medium hover:underline">
                            {l.snapshotTitle}
                          </Link>
                          <div className="text-xs text-gray-500">
                            {l.snapshotVariantName && l.snapshotVariantName !== "Default" && `${l.snapshotVariantName} · `}SKU {l.snapshotSku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{l.quantity}</td>
                    <td className="px-3 py-3 text-right">{money(l.unitPriceCents)}</td>
                    <td className="px-3 py-3 text-right font-medium">{money(l.lineTotalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-sm">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-gray-600">Subtotal</td>
                  <td className="px-3 py-2 text-right">{money(order.subtotalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-gray-600">Shipping</td>
                  <td className="px-3 py-2 text-right">{order.shippingCents === 0 ? "FREE" : money(order.shippingCents)}</td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(order.totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Timeline</h2>
            <ul className="space-y-2 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3 border-l-2 border-gray-200 pl-3">
                  <span className="w-24 text-xs text-gray-500 whitespace-nowrap">
                    {e.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                  </span>
                  <span className="w-20 text-xs font-semibold uppercase text-gray-700">{e.kind}</span>
                  <span className="flex-1">
                    {e.body}{" "}
                    <span className="text-xs text-gray-500">— {e.actor}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <OrderActions orderId={order.id} orderNo={order.orderNo} status={order.status} />
        </div>

        <aside className="space-y-4">
          <section className="rounded border border-gray-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</h2>
            <p className="font-medium">{order.customerName}</p>
            <p><a className="text-blue-700 hover:underline" href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a></p>
            {order.customerPhone && <p>{order.customerPhone}</p>}
            {order.customerNote && (
              <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
                <strong>Customer note:</strong> {order.customerNote}
              </p>
            )}
          </section>

          <section className="rounded border border-gray-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ship to</h2>
            <p>{order.shipStreet}</p>
            {order.shipStreet2 && <p>{order.shipStreet2}</p>}
            <p>{order.shipCity}, {order.shipState} {order.shipZip}</p>
            <p>{order.shipCountry}</p>
            {order.trackingNumber && (
              <p className="mt-2 border-t border-gray-100 pt-2 text-xs">
                <strong>Tracking:</strong> {order.trackingCarrier} · <span className="font-mono">{order.trackingNumber}</span>
              </p>
            )}
          </section>

          {order.paymentRecordedAs && (
            <section className="rounded border border-gray-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment</h2>
              <p>Recorded as: <span className="font-medium">{order.paymentRecordedAs}</span></p>
              {order.paidAt && <p className="text-xs text-gray-500">Marked paid {ts(order.paidAt)}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
