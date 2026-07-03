import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

function money(cents: number) { return "$" + (cents / 100).toFixed(2); }
function ts(d: Date) { return d.toISOString().slice(0, 10); }

export default async function OrderPicklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { lines: { orderBy: { snapshotTitle: "asc" } } },
  });
  if (!order) notFound();

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          header, .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <PrintBar orderId={order.id} orderNo={order.orderNo} />

      {/* PAGE 1 — internal picklist */}
      <div className="print-page bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-800">Ohr Hanachal Press</div>
            <div className="mt-1 text-2xl font-semibold">Picklist</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono text-lg font-semibold">{order.orderNo}</div>
            <div className="text-gray-600">Placed {ts(order.placedAt)}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Ship to</div>
            <div className="font-medium">{order.customerName}</div>
            <div>{order.shipStreet}</div>
            {order.shipStreet2 && <div>{order.shipStreet2}</div>}
            <div>{order.shipCity}, {order.shipState} {order.shipZip}</div>
            <div>{order.shipCountry}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Total items to pick</div>
            <div className="text-4xl font-bold">
              {order.lines.reduce((n, l) => n + l.quantity, 0)}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="p-2 text-left">Qty</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Variant</th>
              <th className="p-2 text-center w-16">Pick ✓</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-300">
                <td className="p-2 text-2xl font-bold">×{l.quantity}</td>
                <td className="p-2 font-mono text-base">{l.snapshotSku}</td>
                <td className="p-2">{l.snapshotTitle}</td>
                <td className="p-2 text-gray-700">
                  {l.snapshotVariantName && l.snapshotVariantName !== "Default" ? l.snapshotVariantName : ""}
                </td>
                <td className="p-2 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.customerNote && (
          <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <strong>Customer note:</strong> {order.customerNote}
          </div>
        )}
      </div>

      {/* PAGE 2 — customer packing slip */}
      <div className="print-page mt-6 bg-white p-8 shadow-sm">
        <div className="mb-6 border-b-2 border-amber-700 pb-4">
          <div className="text-xs uppercase tracking-widest text-amber-800">Ohr Hanachal Press</div>
          <div className="mt-1 font-serif text-3xl text-amber-900">Packing Slip</div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Ship to</div>
            <div className="mt-1 font-medium">{order.customerName}</div>
            <div>{order.shipStreet}</div>
            {order.shipStreet2 && <div>{order.shipStreet2}</div>}
            <div>{order.shipCity}, {order.shipState} {order.shipZip}</div>
            <div>{order.shipCountry}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-500">Order</div>
            <div className="font-mono text-lg font-semibold">{order.orderNo}</div>
            <div className="text-gray-600 text-xs">Placed {ts(order.placedAt)}</div>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-400 text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="p-2">Item</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Unit</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="p-2">
                  <div>{l.snapshotTitle}</div>
                  <div className="text-xs text-gray-500">
                    {l.snapshotVariantName && l.snapshotVariantName !== "Default" && `${l.snapshotVariantName} · `}
                    SKU {l.snapshotSku}
                  </div>
                </td>
                <td className="p-2 text-right">{l.quantity}</td>
                <td className="p-2 text-right">{money(l.unitPriceCents)}</td>
                <td className="p-2 text-right">{money(l.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="p-2 text-right text-gray-600">Subtotal</td>
              <td className="p-2 text-right">{money(order.subtotalCents)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="p-2 text-right text-gray-600">Shipping</td>
              <td className="p-2 text-right">{order.shippingCents === 0 ? "FREE" : money(order.shippingCents)}</td>
            </tr>
            <tr className="border-t-2 border-black">
              <td colSpan={3} className="p-2 text-right font-semibold">Total</td>
              <td className="p-2 text-right font-semibold">{money(order.totalCents)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-10 border-t border-gray-300 pt-4 text-center text-xs text-gray-600">
          <div className="font-serif text-base text-amber-900">Thank you for supporting our press.</div>
          <div className="mt-1">Ohr Hanachal · ohrhanachal.com</div>
        </div>
      </div>
    </>
  );
}

