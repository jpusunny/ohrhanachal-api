import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WholesaleAccountActions from "./WholesaleAccountActions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  approved:  "bg-green-100 text-green-800",
  suspended: "bg-gray-200 text-gray-700",
};

function money(cents: number) { return "$" + (cents / 100).toFixed(2); }
function ts(d: Date) { return d.toISOString().replace("T", " ").slice(0, 16); }

export default async function WholesaleAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.wholesaleAccount.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { placedAt: "desc" }, take: 20 },
    },
  });
  if (!a) notFound();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{a.businessName}</h1>
            <span className={"rounded px-2 py-0.5 text-xs font-medium " + STATUS_COLOR[a.status]}>
              {a.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {a.contactName} · <a className="text-blue-700 hover:underline" href={`mailto:${a.email}`}>{a.email}</a>
            {a.phone && ` · ${a.phone}`}
          </p>
          <p className="text-xs text-gray-500">Signed up {ts(a.createdAt)}</p>
        </div>
        <Link href="/admin/wholesale" className="text-sm text-gray-600 hover:underline">← Back</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <WholesaleAccountActions
            id={a.id}
            status={a.status}
            internalNotes={a.internalNotes ?? ""}
          />

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Orders ({a.orders.length})
            </h2>
            {a.orders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {a.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono hover:underline">{o.orderNo}</Link>
                    <span className="text-xs text-gray-500">{ts(o.placedAt)}</span>
                    <span className="text-xs">{o.status}</span>
                    <span className="font-medium">{money(o.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded border border-gray-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ship to (default)</h2>
            {a.shipStreet ? (
              <>
                <p>{a.shipStreet}</p>
                {a.shipStreet2 && <p>{a.shipStreet2}</p>}
                <p>{a.shipCity}, {a.shipState} {a.shipZip}</p>
                <p>{a.shipCountry}</p>
              </>
            ) : (
              <p className="text-gray-500">Not provided at signup.</p>
            )}
          </section>

          {a.approvedAt && (
            <section className="rounded border border-gray-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Approval</h2>
              <p>{ts(a.approvedAt)}{a.approvedBy && ` by ${a.approvedBy}`}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
