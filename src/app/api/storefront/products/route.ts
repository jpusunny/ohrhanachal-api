import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { isWholesaleContext, pickPriceCents } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  try {
    const { ok: wholesale } = await isWholesaleContext();
    const url = new URL(req.url);
    const pressOnly = url.searchParams.get("press") === "1";

    const products = await prisma.product.findMany({
      where: { status: "active", ...(pressOnly ? { currentlyPrinting: true } : {}) },
      orderBy: { title: "asc" },
      include: {
        variants: {
          where: { active: true },
          select: { id: true, name: true, priceCents: true, wholesalePriceCents: true, compareAtCents: true, weightGrams: true },
          orderBy: { priceCents: "asc" },
        },
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { url: true, altText: true },
        },
      },
    });

    const cards = products.map((p) => {
      const prices = p.variants.map((v) => pickPriceCents(v, wholesale));
      const compareAts = p.variants.map((v) => v.compareAtCents).filter((x): x is number => x != null);
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        titleHe: p.titleHe,
        author: p.author,
        series: p.series,
        authorGroup: p.authorGroup,
        seforGroup: p.seforGroup,
        priceCentsMin: prices.length ? Math.min(...prices) : null,
        priceCentsMax: prices.length ? Math.max(...prices) : null,
        compareAtCentsMax: compareAts.length ? Math.max(...compareAts) : null,
        image: p.images[0] || null,
        variantCount: p.variants.length,
        currentlyPrinting: p.currentlyPrinting,
        wholesale,
      };
    });

    return withCors(req, json({ products: cards, wholesale }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
