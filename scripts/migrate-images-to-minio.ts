import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { extForImage, putImage, randomKey, getS3 } from "../src/lib/s3";

type Row = { id: string; url: string; productId: string };

const SHOPIFY_PREFIX = "https://cdn.shopify.com/";
const CONTENT_TYPE_FALLBACK: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function inferContentTypeFromUrl(u: string): string | null {
  const clean = u.split("?")[0].toLowerCase();
  const ext = clean.substring(clean.lastIndexOf(".") + 1);
  return CONTENT_TYPE_FALLBACK[ext] ?? null;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      concurrency: { type: "string", default: "4" },
    },
  });
  const dryRun = Boolean(values["dry-run"]);
  const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined;
  const concurrency = Math.max(1, Number.parseInt(values.concurrency ?? "4", 10));

  const { publicBase } = dryRun ? { publicBase: process.env.S3_PUBLIC_BASE_URL || "" } : getS3();

  const prisma = new PrismaClient();
  let migrated = 0;
  let skippedAlready = 0;
  let skippedOther = 0;
  const errors: string[] = [];

  try {
    const all = await prisma.productImage.findMany({
      select: { id: true, url: true, productId: true },
      orderBy: { productId: "asc" },
    });
    console.log(`[migrate] found ${all.length} images total`);

    const shopifyRows: Row[] = [];
    for (const img of all) {
      if (publicBase && img.url.startsWith(publicBase)) { skippedAlready++; continue; }
      if (!img.url.startsWith(SHOPIFY_PREFIX)) { skippedOther++; continue; }
      shopifyRows.push(img);
    }
    console.log(`[migrate] to migrate: ${shopifyRows.length}, already on S3: ${skippedAlready}, other: ${skippedOther}`);
    const targets = limit ? shopifyRows.slice(0, limit) : shopifyRows;

    let idx = 0;
    async function worker(id: number) {
      while (true) {
        const i = idx++;
        if (i >= targets.length) return;
        const row = targets[i];
        try {
          const res = await fetch(row.url);
          if (!res.ok) {
            errors.push(`${row.id}: fetch ${res.status} ${row.url}`);
            continue;
          }
          const headerCt = res.headers.get("content-type")?.split(";")[0].trim() || "";
          const ct =
            (headerCt && extForImage(headerCt) ? headerCt : null) ||
            inferContentTypeFromUrl(row.url) ||
            "";
          const ext = extForImage(ct);
          if (!ext) {
            errors.push(`${row.id}: unknown content-type "${headerCt}" for ${row.url}`);
            continue;
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length === 0) {
            errors.push(`${row.id}: empty body ${row.url}`);
            continue;
          }
          const key = randomKey(ext);
          if (dryRun) {
            console.log(`[w${id}] would migrate ${row.id} (${buffer.length}B ${ct}) -> ${key}`);
            migrated++;
            continue;
          }
          const newUrl = await putImage({ buffer, key, contentType: ct });
          await prisma.productImage.update({
            where: { id: row.id },
            data: { url: newUrl },
          });
          migrated++;
          if (migrated % 10 === 0) console.log(`[migrate] progress ${migrated}/${targets.length}`);
        } catch (e) {
          errors.push(`${row.id}: ${(e as Error).message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n[migrate] summary");
  console.log(JSON.stringify({ migrated, skippedAlready, skippedOther, errors }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
