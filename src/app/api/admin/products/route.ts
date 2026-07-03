import { prisma } from "@/lib/prisma";
import { json, parseBody, serverError } from "@/lib/api";
import { productCreateSchema } from "@/lib/products";
import { getSession } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variants: { include: { inventory: true } },
        images: { orderBy: { position: "asc" } },
      },
    });
    return json({ products });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);

    const parsed = await parseBody(req, productCreateSchema);
    if (!parsed.ok) return parsed.res;
    const input = { ...parsed.data, variants: parsed.data.variants ?? [], images: parsed.data.images ?? [] };

    const handle = (input.handle && slugify(input.handle)) ||
      `${slugify(input.title) || "product"}-${randomBytes(3).toString("hex")}`;

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          handle,
          title: input.title,
          titleHe: input.titleHe ?? null,
          author: input.author ?? null,
          series: input.series ?? null,
          authorGroup: input.authorGroup ?? "other",
          seforGroup: input.seforGroup ? slugify(input.seforGroup) || null : null,
          descriptionHtml: input.descriptionHtml ?? null,
          status: input.status,
          voiceCode: input.voiceCode || null,
          currentlyPrinting: input.currentlyPrinting ?? false,
          images: {
            create: input.images.map((img, idx) => ({
              url: img.url,
              altText: img.altText ?? null,
              position: img.position ?? idx,
            })),
          },
        },
      });

      for (const v of input.variants) {
        const variant = await tx.variant.create({
          data: {
            productId: product.id,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode ?? null,
            priceCents: v.priceCents,
            wholesalePriceCents: v.wholesalePriceCents ?? null,
            compareAtCents: v.compareAtCents ?? null,
            weightGrams: v.weightGrams ?? null,
            active: v.active ?? true,
          },
        });
        const initial = v.initialOnHand ?? 0;
        await tx.inventoryLevel.create({
          data: {
            variantId: variant.id,
            onHand: initial,
            reorderPoint: v.reorderPoint ?? null,
          },
        });
        if (initial > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              delta: initial,
              reason: "initial",
              actor: session.email,
              note: "initial stock at product creation",
            },
          });
        }
      }

      return await tx.product.findUnique({
        where: { id: product.id },
        include: {
          variants: { include: { inventory: true } },
          images: { orderBy: { position: "asc" } },
        },
      });
    });

    return json({ product: created }, 201);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return json({ error: "unique_constraint", details: (e as { meta?: unknown }).meta }, 409);
    }
    return serverError(e);
  }
}
