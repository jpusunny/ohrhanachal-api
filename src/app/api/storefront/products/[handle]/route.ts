import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, notFound, serverError } from "@/lib/api";
import { isWholesaleContext, pickPriceCents } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const p = await prisma.product.findUnique({
      where: { handle },
      include: {
        variants: {
          where: { active: true },
          include: { inventory: { select: { onHand: true, reserved: true } } },
          orderBy: { priceCents: "asc" },
        },
        images: { orderBy: { position: "asc" } },
      },
    });
    if (!p || p.status !== "active") return withCors(req, notFound());

    const { ok: wholesale } = await isWholesaleContext();
    const variants = p.variants.map((v) => {
      const onHand = v.inventory?.onHand ?? 0;
      const reserved = v.inventory?.reserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      return {
        id: v.id,
        name: v.name,
        sku: v.sku,
        priceCents: pickPriceCents(v, wholesale),
        compareAtCents: v.compareAtCents,
        weightGrams: v.weightGrams,
        inStock: available > 0,
      };
    });

    // Sibling products in the same seforGroup: "also available in" swatches.
    const siblings = p.seforGroup
      ? await prisma.product.findMany({
          where: {
            seforGroup: p.seforGroup,
            status: "active",
            NOT: { id: p.id },
          },
          select: {
            handle: true,
            title: true,
            images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
            variants: {
              where: { active: true },
              orderBy: { priceCents: "asc" },
              take: 1,
              select: { priceCents: true, wholesalePriceCents: true },
            },
          },
        })
      : [];

    return withCors(
      req,
      json({
        product: {
          id: p.id,
          handle: p.handle,
          title: p.title,
          titleHe: p.titleHe,
          author: p.author,
          series: p.series,
          authorGroup: p.authorGroup,
          seforGroup: p.seforGroup,
          descriptionHtml: p.descriptionHtml,
          variants,
          images: p.images.map((i) => ({ url: i.url, altText: i.altText, position: i.position })),
          wholesale,
          siblings: siblings.map((s) => ({
            handle: s.handle,
            title: s.title,
            image: s.images[0]?.url ?? null,
            priceCents: s.variants[0] ? pickPriceCents(s.variants[0], wholesale) : null,
          })),
        },
      }),
    );
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
