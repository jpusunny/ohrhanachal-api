import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", approved: "Approved", suspended: "Suspended",
};
const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  approved:  "bg-green-100 text-green-800",
  suspended: "bg-gray-200 text-gray-700",
};

export default async function WholesaleAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "all";

  const validStatus = ["pending", "approved", "suspended"] as const;
  const accounts = await prisma.wholesaleAccount.findMany({
    where: validStatus.includes(status as (typeof validStatus)[number])
      ? { status: status as (typeof validStatus)[number] }
      : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const counts: Record<string, number> = {};
  for (const s of validStatus) {
    counts[s] = await prisma.wholesaleAccount.count({ where: { status: s } });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wholesale accounts</h1>
        <Link href="/admin/products" className="text-sm text-gray-600 hover:underline">← Back</Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["all", "All"], ...validStatus.map((s) => [s, STATUS_LABEL[s]] as const)].map(([key, label]) => (
          <Link
            key={String(key)}
            href={String(key) === "all" ? "/admin/wholesale" : `/admin/wholesale?status=${key}`}
            className={
              "rounded px-3 py-1 text-sm " +
              (status === String(key) || (status === "all" && String(key) === "all")
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            {label}
            {String(key) !== "all" && counts[String(key)] > 0 && (
              <span className="ml-1 opacity-70">({counts[String(key)]})</span>
            )}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Signed up</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                No accounts here.
              </td></tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="font-medium">{a.businessName}</div>
                  {a.taxId && <div className="text-xs text-gray-500">Tax ID {a.taxId}</div>}
                </td>
                <td className="px-3 py-2">
                  <div>{a.contactName}</div>
                  <div className="text-xs text-gray-500">
                    <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>
                    {a.phone && ` · ${a.phone}`}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                  {a.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <span className={"rounded px-2 py-0.5 text-xs font-medium " + STATUS_COLOR[a.status]}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/wholesale/${a.id}`} className="text-blue-700 text-sm hover:underline">
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
