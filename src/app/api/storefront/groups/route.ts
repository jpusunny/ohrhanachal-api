import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

const FORMAT_ORDER = ["Regular", "Pocket", "Leather", "Set"];

function formatOf(title: string): string {
  const t = title.toLowerCase();
  if (/\bset\b/.test(t)) return "Set";
  if (t.includes("leather")) return "Leather";
  if (t.includes("pocket")) return "Pocket";
  return "Regular";
}

function pickPrimary(members: { handle: string; title: string }[]) {
  const nonSet = members.filter((m) => !/^set-/.test(m.handle));
  const regularish = nonSet.find((m) => formatOf(m.title) === "Regular");
  if (regularish) return regularish;
  if (nonSet.length) return nonSet[0];
  return members[0];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const series = url.searchParams.get("series");

    const where: {
      status: "active";
      authorGroup?: "nachman" | "nossen" | "anash" | "set";
      NOT?: { seforGroup: null };
    } = { status: "active" };
    if (series === "nachman" || series === "nossen" || series === "anash" || series === "set") {
      where.authorGroup = series;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { title: "asc" },
      include: {
        variants: {
          where: { active: true },
          select: { priceCents: true },
        },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true, altText: true } },
      },
    });

    type GroupAgg = {
      slug: string;
      title: string;
      titleHe: string | null;
      authorGroup: string;
      priceCentsMin: number | null;
      priceCentsMax: number | null;
      image: { url: string; altText: string | null } | null;
      formats: Set<string>;
      members: { handle: string; title: string }[];
      count: number;
    };

    const groups = new Map<string, GroupAgg>();
    for (const p of products) {
      const slug = p.seforGroup || p.handle;
      let g = groups.get(slug);
      if (!g) {
        g = {
          slug,
          title: p.title,
          titleHe: p.titleHe,
          authorGroup: p.authorGroup,
          priceCentsMin: null,
          priceCentsMax: null,
          image: null,
          formats: new Set<string>(),
          members: [],
          count: 0,
        };
        groups.set(slug, g);
      }
      g.count++;
      g.formats.add(formatOf(p.title));
      g.members.push({ handle: p.handle, title: p.title });
      // Prefer titleHe from any member that has one.
      if (!g.titleHe && p.titleHe) g.titleHe = p.titleHe;
      // Prefer image from the primary member (or first non-null).
      if (!g.image && p.images[0]) g.image = p.images[0];
      for (const v of p.variants) {
        if (g.priceCentsMin == null || v.priceCents < g.priceCentsMin) g.priceCentsMin = v.priceCents;
        if (g.priceCentsMax == null || v.priceCents > g.priceCentsMax) g.priceCentsMax = v.priceCents;
      }
    }

    const list = Array.from(groups.values()).map((g) => {
      const primary = pickPrimary(g.members);
      // Set group title to the primary product's title if available (drops "- Pocket" etc.)
      const title = primary.title.replace(/\s*[-—]\s*(pocket|leather|set|pocket leather|pocket - leather).*$/i, "").trim() || g.title;
      const formats = FORMAT_ORDER.filter((f) => g.formats.has(f));
      return {
        slug: g.slug,
        title,
        titleHe: g.titleHe,
        authorGroup: g.authorGroup,
        priceCentsMin: g.priceCentsMin,
        priceCentsMax: g.priceCentsMax,
        image: g.image,
        formats,
        productHandle: primary.handle,
        count: g.count,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));

    return withCors(req, json({ groups: list }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
