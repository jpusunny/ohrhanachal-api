import { PrismaClient, ProductStatus } from "@prisma/client";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

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
      // ignore, \n will close the record
    } else { field += c; }
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }
  const [header, ...data] = rows;
  return data
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as Row);
}

function priceToCents(dollars: string): number {
  const n = Number.parseFloat(dollars);
  if (!Number.isFinite(n)) throw new Error(`bad price: ${dollars}`);
  return Math.round(n * 100);
}

function toIntOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function mapStatus(v: string): ProductStatus {
  return v === "active" ? "active" : "draft";
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string", short: "f" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const file = values.file || process.env.CATALOG_CSV || "/home/azureuser/work/catalog.csv";
  const dryRun = Boolean(values["dry-run"]);

  console.log(`[import] file=${file} dryRun=${dryRun}`);
  const text = readFileSync(file, "utf8");
  const rows = parseCsv(text);
  console.log(`[import] parsed ${rows.length} rows`);

  const byHandle = new Map<string, Row[]>();
  for (const r of rows) {
    const h = r["Handle"]; if (!h) continue;
    if (!byHandle.has(h)) byHandle.set(h, []);
    byHandle.get(h)!.push(r);
  }
  console.log(`[import] ${byHandle.size} unique handles`);

  const prisma = new PrismaClient();
  const summary = {
    productsCreated: 0,
    productsSkipped: 0,
    imagesAdded: 0,
    imagesSkipped: 0,
    errors: [] as string[],
  };

  try {
    for (const [handle, rs] of byHandle) {
      const head = rs.find((r) => r["Variant SKU"]);
      if (!head) { summary.errors.push(`${handle}: no row with SKU`); continue; }

      const sku = head["Variant SKU"].trim();
      const title = head["Title"].trim();
      if (!title) { summary.errors.push(`${handle}: no title`); continue; }

      const images = rs
        .filter((r) => r["Image Src"])
        .map((r) => ({
          url: r["Image Src"].trim(),
          altText: r["Image Alt Text"]?.trim() || null,
          position: toIntOrNull(r["Image Position"]) ?? 0,
        }));

      const existingVariant = await prisma.variant.findUnique({
        where: { sku },
        include: { product: true },
      });

      let productId: string;
      if (existingVariant) {
        productId = existingVariant.productId;
        summary.productsSkipped++;
        console.log(`[skip product] ${handle} sku=${sku} (variant exists)`);
      } else {
        const priceCents = priceToCents(head["Variant Price"]);
        const weightGrams = toIntOrNull(head["Variant Grams"]);
        const qty = toIntOrNull(head["Variant Inventory Qty"]) ?? 0;
        const status = mapStatus(head["Status"]);
        const descriptionHtml = head["Body (HTML)"] || null;
        const barcode = head["Variant Barcode"]?.trim() || null;

        if (dryRun) {
          console.log(`[create product] ${handle} title="${title}" sku=${sku} price=${priceCents}c qty=${qty} status=${status}`);
          summary.productsCreated++;
        } else {
          const created = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
              data: {
                title,
                descriptionHtml,
                status,
              },
            });
            const variant = await tx.variant.create({
              data: {
                productId: product.id,
                name: "Default",
                sku,
                barcode,
                priceCents,
                weightGrams,
                active: status === "active",
              },
            });
            await tx.inventoryLevel.create({
              data: { variantId: variant.id, onHand: qty },
            });
            if (qty !== 0) {
              await tx.stockMovement.create({
                data: {
                  variantId: variant.id,
                  delta: qty,
                  reason: "initial",
                  actor: "catalog-import",
                  note: `Shopify handle ${handle}`,
                },
              });
            }
            return product;
          });
          productId = created.id;
          summary.productsCreated++;
          console.log(`[created] ${handle} product=${productId} sku=${sku} qty=${qty}`);
        }
      }

      // Images — idempotent by URL per product.
      if (productId! /* set unless dry-run+new */) {
        const existingUrls = new Set(
          (await prisma.productImage.findMany({
            where: { productId },
            select: { url: true },
          })).map((i) => i.url),
        );
        for (const img of images) {
          if (existingUrls.has(img.url)) { summary.imagesSkipped++; continue; }
          if (dryRun) {
            console.log(`  [would add image] pos=${img.position} ${img.url}`);
            summary.imagesAdded++;
          } else {
            await prisma.productImage.create({
              data: { productId, url: img.url, altText: img.altText, position: img.position },
            });
            summary.imagesAdded++;
          }
        }
      } else {
        // dry-run + newly-created product: log images we'd add.
        for (const img of images) {
          console.log(`  [would add image] pos=${img.position} ${img.url}`);
          summary.imagesAdded++;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n[import] summary");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
