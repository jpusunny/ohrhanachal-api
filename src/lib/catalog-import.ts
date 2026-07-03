import type { PrismaClient, ProductStatus } from "@prisma/client";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
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
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as CsvRow);
}

function priceToCents(dollars: string): number | null {
  const n = Number.parseFloat(dollars);
  if (!Number.isFinite(n)) return null;
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

export type ImportPlanRow = {
  handle: string;
  action: "create" | "skip" | "error";
  reason?: string;
  productSummary?: { title: string; sku: string; priceCents: number; qty: number; status: ProductStatus; imageCount: number };
};

export type ImportPlan = {
  rows: ImportPlanRow[];
  productsToCreate: number;
  productsToSkip: number;
  errors: number;
  imageOps: { toAdd: number; alreadyPresent: number };
};

export type ImportSummary = {
  productsCreated: number;
  productsSkipped: number;
  imagesAdded: number;
  imagesSkipped: number;
  errors: string[];
};

type Prepared = {
  handle: string;
  head: CsvRow;
  images: { url: string; altText: string | null; position: number }[];
  sku: string;
  priceCents: number;
  weightGrams: number | null;
  qty: number;
  status: ProductStatus;
  descriptionHtml: string | null;
  barcode: string | null;
  title: string;
};

function prepare(rowsByHandle: Map<string, CsvRow[]>): { good: Prepared[]; bad: ImportPlanRow[] } {
  const good: Prepared[] = [];
  const bad: ImportPlanRow[] = [];
  for (const [handle, rs] of rowsByHandle) {
    const head = rs.find((r) => r["Variant SKU"]);
    if (!head) { bad.push({ handle, action: "error", reason: "no row with SKU" }); continue; }
    const title = head["Title"]?.trim();
    if (!title) { bad.push({ handle, action: "error", reason: "no title" }); continue; }
    const sku = head["Variant SKU"].trim();
    const priceCents = priceToCents(head["Variant Price"] ?? "0");
    if (priceCents == null) { bad.push({ handle, action: "error", reason: `bad price: ${head["Variant Price"]}` }); continue; }
    const images = rs
      .filter((r) => r["Image Src"])
      .map((r) => ({
        url: r["Image Src"].trim(),
        altText: r["Image Alt Text"]?.trim() || null,
        position: toIntOrNull(r["Image Position"]) ?? 0,
      }));
    good.push({
      handle,
      head,
      images,
      sku,
      priceCents,
      weightGrams: toIntOrNull(head["Variant Grams"]),
      qty: toIntOrNull(head["Variant Inventory Qty"]) ?? 0,
      status: mapStatus(head["Status"] ?? ""),
      descriptionHtml: head["Body (HTML)"] || null,
      barcode: head["Variant Barcode"]?.trim() || null,
      title,
    });
  }
  return { good, bad };
}

function groupByHandle(rows: CsvRow[]): Map<string, CsvRow[]> {
  const m = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const h = r["Handle"]; if (!h) continue;
    if (!m.has(h)) m.set(h, []);
    m.get(h)!.push(r);
  }
  return m;
}

export async function buildPlan(prisma: PrismaClient, csvText: string): Promise<ImportPlan> {
  const rows = parseCsv(csvText);
  const grouped = groupByHandle(rows);
  const { good, bad } = prepare(grouped);
  const skus = good.map((g) => g.sku);
  const existingVariants = await prisma.variant.findMany({
    where: { sku: { in: skus } },
    include: {
      product: { include: { images: { select: { url: true } } } },
    },
  });
  const bySku = new Map(existingVariants.map((v) => [v.sku, v]));

  const rowsOut: ImportPlanRow[] = [];
  let imgAdd = 0;
  let imgPresent = 0;
  let toCreate = 0;
  let toSkip = 0;
  for (const g of good) {
    const existing = bySku.get(g.sku);
    if (existing) {
      const existingUrls = new Set(existing.product.images.map((i) => i.url));
      for (const img of g.images) {
        if (existingUrls.has(img.url)) imgPresent++;
        else imgAdd++;
      }
      toSkip++;
      rowsOut.push({
        handle: g.handle,
        action: "skip",
        reason: `SKU ${g.sku} already exists (${existing.product.title})`,
      });
    } else {
      toCreate++;
      imgAdd += g.images.length;
      rowsOut.push({
        handle: g.handle,
        action: "create",
        productSummary: {
          title: g.title, sku: g.sku, priceCents: g.priceCents,
          qty: g.qty, status: g.status, imageCount: g.images.length,
        },
      });
    }
  }
  for (const b of bad) rowsOut.push(b);
  return {
    rows: rowsOut,
    productsToCreate: toCreate,
    productsToSkip: toSkip,
    errors: bad.length,
    imageOps: { toAdd: imgAdd, alreadyPresent: imgPresent },
  };
}

export async function applyPlan(
  prisma: PrismaClient,
  csvText: string,
  opts: { actor: string },
): Promise<ImportSummary> {
  const rows = parseCsv(csvText);
  const grouped = groupByHandle(rows);
  const { good, bad } = prepare(grouped);
  const summary: ImportSummary = {
    productsCreated: 0,
    productsSkipped: 0,
    imagesAdded: 0,
    imagesSkipped: 0,
    errors: bad.map((b) => `${b.handle}: ${b.reason ?? "error"}`),
  };
  for (const g of good) {
    try {
      const existing = await prisma.variant.findUnique({
        where: { sku: g.sku },
        include: { product: true },
      });
      let productId: string;
      if (existing) {
        productId = existing.productId;
        summary.productsSkipped++;
      } else {
        const created = await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              handle: g.handle,
              title: g.title,
              descriptionHtml: g.descriptionHtml,
              status: g.status,
            },
          });
          const variant = await tx.variant.create({
            data: {
              productId: product.id,
              name: "Default",
              sku: g.sku,
              barcode: g.barcode,
              priceCents: g.priceCents,
              weightGrams: g.weightGrams,
              active: g.status === "active",
            },
          });
          await tx.inventoryLevel.create({ data: { variantId: variant.id, onHand: g.qty } });
          if (g.qty !== 0) {
            await tx.stockMovement.create({
              data: {
                variantId: variant.id,
                delta: g.qty,
                reason: "initial",
                actor: opts.actor,
                note: `csv-import ${g.handle}`,
              },
            });
          }
          return product;
        });
        productId = created.id;
        summary.productsCreated++;
      }
      const existingUrls = new Set(
        (await prisma.productImage.findMany({
          where: { productId },
          select: { url: true },
        })).map((i) => i.url),
      );
      for (const img of g.images) {
        if (existingUrls.has(img.url)) { summary.imagesSkipped++; continue; }
        await prisma.productImage.create({
          data: { productId, url: img.url, altText: img.altText, position: img.position },
        });
        summary.imagesAdded++;
      }
    } catch (e) {
      summary.errors.push(`${g.handle}: ${(e as Error).message}`);
    }
  }
  return summary;
}
