import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, notFound, parseBody, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  body: z.string().min(1).max(2000),
  internal: z.boolean().optional().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const { id } = await params;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) return notFound();

    const body = parsed.data.internal ? `[internal] ${parsed.data.body}` : parsed.data.body;
    const event = await prisma.orderEvent.create({
      data: { orderId: id, kind: "note", actor: `admin:${session.email}`, body },
    });
    return json({ event: { id: event.id, kind: event.kind, body: event.body, createdAt: event.createdAt } });
  } catch (e) {
    return serverError(e);
  }
}
