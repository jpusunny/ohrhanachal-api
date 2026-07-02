import { prisma } from "@/lib/prisma";
import { json, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const movements = await prisma.stockMovement.findMany({
      where: { variantId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json({ movements });
  } catch (e) {
    return serverError(e);
  }
}
