import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, notFound, parseBody, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "delta_must_be_nonzero"),
  reason: z.enum(["initial", "manual_adjustment", "order", "return", "correction"]),
  note: z.string().max(2000).nullish(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);

    const { id } = await ctx.params;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;
    const { delta, reason, note } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({ where: { id }, include: { inventory: true } });
      if (!variant) return { notFound: true as const };

      const current = variant.inventory?.onHand ?? 0;
      const next = current + delta;
      if (next < 0) return { negative: true as const, current };

      const inventory = await tx.inventoryLevel.upsert({
        where: { variantId: id },
        update: { onHand: next },
        create: { variantId: id, onHand: next },
      });
      const movement = await tx.stockMovement.create({
        data: { variantId: id, delta, reason, note: note ?? null, actor: session.email },
      });
      return { inventory, movement };
    });

    if ("notFound" in result) return notFound("variant_not_found");
    if ("negative" in result)
      return json({ error: "would_go_negative", currentOnHand: result.current }, 400);
    return json(result);
  } catch (e) {
    return serverError(e);
  }
}
