import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUTHOR_LABEL: Record<string, string> = {
  nachman: "R' Nachman",
  nossen: "R' Nossen",
  anash: "Anash",
  set: "Sets",
  other: "Other",
};

function money(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export default async function GroupsPage() {
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    include: { variants: { include: { inventory: true } } },
  });

  type GroupAgg = {
    slug: string;
    title: string;
    titleHe: string | null;
    authorGroup: string;
    formats: Set<string>;
    memberCount: number;
    variantCount: number;
    activeCount: number;
    draftCount: number;
    totalOnHand: number;
    totalReserved: number;
    totalReorder: number;
    inventoryValueCents: number;
    lowVariantCount: number;
    memberIds: string[];
  };

  const groups = new Map<string, GroupAgg>();
  const orphan: typeof products = [];
  for (const p of products) {
    const key = p.seforGroup || "";
    if (!key) { orphan.push(p); continue; }
    let g = groups.get(key);
    if (!g) {
      g = {
        slug: key,
        title: p.title.replace(/\s*[-—]\s*(pocket|leather|set|pocket leather).*$/i, "").trim() || p.title,
        titleHe: p.titleHe,
        authorGroup: p.authorGroup,
        formats: new Set(),
        memberCount: 0,
        variantCount: 0,
        activeCount: 0,
        draftCount: 0,
        totalOnHand: 0,
        totalReserved: 0,
        totalReorder: 0,
        inventoryValueCents: 0,
        lowVariantCount: 0,
        memberIds: [],
      };
      groups.set(key, g);
    }
    if (!g.titleHe && p.titleHe) g.titleHe = p.titleHe;
    g.memberCount++;
    g.memberIds.push(p.id);
    if (p.status === "active") g.activeCount++;
    else g.draftCount++;
    for (const v of p.variants) {
      g.variantCount++;
      g.formats.add(v.name);
      const onHand = v.inventory?.onHand ?? 0;
      const reserved = v.inventory?.reserved ?? 0;
      const rp = v.inventory?.reorderPoint;
      g.totalOnHand += onHand;
      g.totalReserved += reserved;
      g.inventoryValueCents += onHand * v.priceCents;
      if (rp != null) g.totalReorder += rp;
      if (rp != null && onHand - reserved <= rp) g.lowVariantCount++;
    }
  }

  const list = Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title));
  const totalValue = list.reduce((s, g) => s + g.inventoryValueCents, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sefer groups</h1>
        <Link href="/admin/products" className="text-sm text-gray-600 hover:underline">
          ← Back to products
        </Link>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Sefer groups collect all format-variants of the same title (Regular / Pocket / Leather / Set)
        under one storefront card. {list.length} group{list.length === 1 ? "" : "s"}
        {orphan.length > 0 && <> · {orphan.length} product{orphan.length === 1 ? "" : "s"} not in a group</>}
        {" "}· {money(totalValue)} total inventory value.
      </p>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Series</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Formats</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3">Low</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((g) => (
              <tr key={g.slug} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{g.title}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono">{g.slug}</span>
                    {g.titleHe && <span className="ml-2" dir="rtl">{g.titleHe}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{AUTHOR_LABEL[g.authorGroup] || g.authorGroup}</td>
                <td className="px-4 py-3">
                  <div>{g.memberCount} product{g.memberCount === 1 ? "" : "s"}</div>
                  <div className="text-xs text-gray-500">
                    {g.activeCount} active{g.draftCount > 0 && <> · {g.draftCount} draft</>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {Array.from(g.formats).join(", ")}
                </td>
                <td className="px-4 py-3 text-right">
                  {g.totalOnHand}
                  {g.totalReserved > 0 && (
                    <div className="text-xs text-gray-500">−{g.totalReserved} reserved</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{money(g.inventoryValueCents)}</td>
                <td className="px-4 py-3">
                  {g.lowVariantCount > 0 ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {g.lowVariantCount} variant{g.lowVariantCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No sefer groups yet. Assign one in the product edit form.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orphan.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Products not in a group
          </h2>
          <ul className="rounded border border-gray-200 bg-white p-4 text-sm">
            {orphan.map((p) => (
              <li key={p.id} className="py-1">
                <Link href={`/admin/products/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
                <span className="ml-2 font-mono text-xs text-gray-500">{p.handle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
