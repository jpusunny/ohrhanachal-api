import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    include: {
      variants: { include: { inventory: true }, orderBy: { name: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });

  const rows: string[] = [];
  const header = [
    "Handle", "Title", "Title (Hebrew)", "Author", "Series",
    "Author Group", "Sefer Group", "Status", "Voice Code",
    "Variant Name", "Variant SKU", "Variant Barcode",
    "Variant Price (cents)", "Compare-at (cents)", "Variant Weight (g)",
    "Variant Active", "On Hand", "Reserved", "Reorder Point",
    "Image URL", "Image Position", "Image Alt",
  ];
  rows.push(header.map(csvEscape).join(","));

  for (const p of products) {
    if (p.variants.length === 0 && p.images.length === 0) {
      rows.push([
        p.handle, p.title, p.titleHe, p.author, p.series,
        p.authorGroup, p.seforGroup, p.status, p.voiceCode,
        "", "", "", "", "", "", "", "", "", "",
        "", "", "",
      ].map(csvEscape).join(","));
      continue;
    }
    const variantsOrEmpty = p.variants.length > 0 ? p.variants : [null];
    for (const [vIdx, v] of variantsOrEmpty.entries()) {
      // First variant row also emits image data; subsequent variants keep image cols blank
      // to keep the CSV round-trippable through the import script.
      const imgRows = vIdx === 0 && p.images.length > 0 ? p.images : [null];
      for (const img of imgRows) {
        rows.push([
          p.handle, p.title, p.titleHe, p.author, p.series,
          p.authorGroup, p.seforGroup, p.status, p.voiceCode,
          v?.name ?? "", v?.sku ?? "", v?.barcode ?? "",
          v?.priceCents ?? "", v?.compareAtCents ?? "", v?.weightGrams ?? "",
          v == null ? "" : v.active ? "true" : "false",
          v?.inventory?.onHand ?? "", v?.inventory?.reserved ?? "", v?.inventory?.reorderPoint ?? "",
          img?.url ?? "", img?.position ?? "", img?.altText ?? "",
        ].map(csvEscape).join(","));
      }
    }
  }

  const body = rows.join("\r\n") + "\r\n";
  const filename = `ohr-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
