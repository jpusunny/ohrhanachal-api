import { prisma } from "@/lib/prisma";
import { json, notFound, parseBody, serverError } from "@/lib/api";
import { productUpdateSchema } from "@/lib/products";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: { inventory: true, movements: { orderBy: { createdAt: "desc" }, take: 20 } } },
        images: { orderBy: { position: "asc" } },
      },
    });
    if (!product) return notFound();
    return json({ product });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, productUpdateSchema);
    if (!parsed.ok) return parsed.res;
    const input = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) return null;

      const nextHandle = input.handle ? (slugify(input.handle) || existing.handle) : existing.handle;
      const nextSeforGroup =
        input.seforGroup === undefined
          ? existing.seforGroup
          : input.seforGroup ? (slugify(input.seforGroup) || null) : null;

      await tx.product.update({
        where: { id },
        data: {
          handle: nextHandle,
          title: input.title ?? existing.title,
          titleHe: input.titleHe === undefined ? existing.titleHe : input.titleHe,
          author: input.author === undefined ? existing.author : input.author,
          series: input.series === undefined ? existing.series : input.series,
          authorGroup: input.authorGroup ?? existing.authorGroup,
          seforGroup: nextSeforGroup,
          descriptionHtml:
            input.descriptionHtml === undefined ? existing.descriptionHtml : input.descriptionHtml,
          status: input.status ?? existing.status,
          voiceCode: input.voiceCode === undefined ? existing.voiceCode : input.voiceCode || null,
        },
      });

      if (input.images) {
        const existingImgs = await tx.productImage.findMany({ where: { productId: id } });
        const keepIds = new Set(input.images.map((i) => i.id).filter(Boolean) as string[]);
        for (const img of existingImgs) {
          if (!keepIds.has(img.id)) await tx.productImage.delete({ where: { id: img.id } });
        }
        for (const [idx, img] of input.images.entries()) {
          if (img.id) {
            await tx.productImage.update({
              where: { id: img.id },
              data: { url: img.url, altText: img.altText ?? null, position: img.position ?? idx },
            });
          } else {
            await tx.productImage.create({
              data: { productId: id, url: img.url, altText: img.altText ?? null, position: img.position ?? idx },
            });
          }
        }
      }

      if (input.variants) {
        const existingVariants = await tx.variant.findMany({ where: { productId: id } });
        const keepIds = new Set(input.variants.map((v) => v.id).filter(Boolean) as string[]);
        for (const v of existingVariants) {
          if (!keepIds.has(v.id)) await tx.variant.delete({ where: { id: v.id } });
        }
        for (const v of input.variants) {
          if (v.id) {
            await tx.variant.update({
              where: { id: v.id },
              data: {
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
            if (v.reorderPoint !== undefined) {
              await tx.inventoryLevel.upsert({
                where: { variantId: v.id },
                create: { variantId: v.id, onHand: 0, reorderPoint: v.reorderPoint ?? null },
                update: { reorderPoint: v.reorderPoint ?? null },
              });
            }
          } else {
            const created = await tx.variant.create({
              data: {
                productId: id,
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
            await tx.inventoryLevel.create({
              data: {
                variantId: created.id,
                onHand: v.initialOnHand ?? 0,
                reorderPoint: v.reorderPoint ?? null,
              },
            });
          }
        }
      }

      return await tx.product.findUnique({
        where: { id },
        include: {
          variants: { include: { inventory: true } },
          images: { orderBy: { position: "asc" } },
        },
      });
    });

    if (!updated) return notFound();
    return json({ product: updated });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return json({ error: "unique_constraint", details: (e as { meta?: unknown }).meta }, 409);
    }
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await prisma.product.delete({ where: { id } });
    return json({ ok: true });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2025") {
      return notFound();
    }
    return serverError(e);
  }
}
