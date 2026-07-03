import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n") {
      record.push(field); rows.push(record); record = []; field = "";
    } else if (c === "\r") {
      // skip
    } else { field += c; }
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }
  const [header, ...data] = rows;
  return data
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as Row);
}

async function main() {
  const file = process.env.CATALOG_CSV || "/home/azureuser/work/catalog.csv";
  const rows = parseCsv(readFileSync(file, "utf8"));

  // Build sku -> handle map from CSV (only rows that have a SKU)
  const skuToHandle = new Map<string, string>();
  for (const r of rows) {
    if (r["Variant SKU"] && r["Handle"]) skuToHandle.set(r["Variant SKU"].trim(), r["Handle"]);
  }
  console.log(`[backfill] CSV: ${skuToHandle.size} sku→handle pairs`);

  const prisma = new PrismaClient();
  let updated = 0, alreadyOk = 0, skipped = 0;
  const errors: string[] = [];
  try {
    const products = await prisma.product.findMany({
      include: { variants: { select: { sku: true } } },
    });
    console.log(`[backfill] DB: ${products.length} products`);

    for (const p of products) {
      const handleFromCsv = p.variants.map((v) => skuToHandle.get(v.sku)).find(Boolean);
      if (!handleFromCsv) {
        skipped++;
        console.log(`[skip] ${p.id} title="${p.title}" — no SKU match in CSV`);
        continue;
      }
      if (p.handle === handleFromCsv) { alreadyOk++; continue; }
      try {
        await prisma.product.update({
          where: { id: p.id },
          data: { handle: handleFromCsv },
        });
        updated++;
        console.log(`[set] ${p.id} handle="${handleFromCsv}"`);
      } catch (e) {
        errors.push(`${p.id}: ${(e as Error).message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n[backfill] summary");
  console.log(JSON.stringify({ updated, alreadyOk, skipped, errors }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
