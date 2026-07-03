import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, parseBody, serverError } from "@/lib/api";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.enum(["initial", "manual_adjustment", "order", "return", "correction"]),
  note: z.string().optional(),
  entries: z
    .array(z.object({ variantId: z.string().min(1), delta: z.number().int() }))
    .min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    const batchId = randomBytes(6).toString("hex");
    const nonZero = parsed.data.entries.filter((e) => e.delta !== 0);
    if (nonZero.length === 0) return json({ error: "no_changes" }, 400);

    const result = await prisma.$transaction(async (tx) => {
      const applied: { variantId: string; delta: number; onHand: number }[] = [];
      for (const { variantId, delta } of nonZero) {
        const inv = await tx.inventoryLevel.upsert({
          where: { variantId },
          create: { variantId, onHand: Math.max(0, delta) },
          update: { onHand: { increment: delta } },
        });
        if (inv.onHand < 0) {
          throw new Error(`variant ${variantId} would go below 0`);
        }
        await tx.stockMovement.create({
          data: {
            variantId,
            delta,
            reason: parsed.data.reason,
            actor: session.email,
            note: [`[batch:${batchId}]`, parsed.data.note].filter(Boolean).join(" ").slice(0, 500),
          },
        });
        applied.push({ variantId, delta, onHand: inv.onHand });
      }
      return applied;
    });

    return json({ batchId, applied: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("would go below 0")) return json({ error: "below_zero", details: msg }, 409);
    return serverError(e);
  }
}
