import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, parseBody, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  mode: z.enum(["percent", "flat_cents", "set_cents"]),
  value: z.number(),
  variantIds: z.array(z.string().min(1)).min(1),
  round: z.enum(["cent", "nine", "none"]).default("cent"),
});

function roundCents(n: number, rounding: "cent" | "nine" | "none"): number {
  if (rounding === "none") return Math.max(0, Math.round(n));
  if (rounding === "nine") {
    // round to nearest .99 dollar: xxxx99 cents
    const dollars = Math.max(0, Math.round(n / 100));
    return dollars * 100 - 1 < 0 ? 0 : dollars * 100 - 1;
  }
  return Math.max(0, Math.round(n));
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;
    const { mode, value, variantIds } = parsed.data;
    const round = parsed.data.round ?? "cent";

    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, priceCents: true, sku: true },
    });

    const updates = variants.map((v) => {
      const raw = mode === "percent"
        ? v.priceCents * (1 + value / 100)
        : mode === "flat_cents"
          ? v.priceCents + value
          : value;
      const next = roundCents(raw, round);
      return { id: v.id, from: v.priceCents, to: next, sku: v.sku };
    });

    await prisma.$transaction(
      updates.map((u) =>
        prisma.variant.update({ where: { id: u.id }, data: { priceCents: u.to } }),
      ),
    );

    // Session-level breadcrumb: we don't have a PriceHistory model, but the
    // updatedAt bump is enough for now. Owner can spot-check via CSV export.
    void session;

    return json({ updated: updates.length, changes: updates });
  } catch (e) {
    return serverError(e);
  }
}
