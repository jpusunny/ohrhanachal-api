import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { getCustomerSession } from "@/lib/customer-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

export async function GET(req: Request) {
  try {
    const sess = await getCustomerSession();
    if (!sess) return withCors(req, json({ orders: [] }));

    const orders = await prisma.order.findMany({
      // Both linked orders and email-matched guest orders that pre-date signup
      // link. On signup we backfill, but this OR guards against dropped writes.
      where: { OR: [{ customerId: sess.sub }, { customerEmail: sess.email }] },
      orderBy: { placedAt: "desc" },
      take: 100,
      select: {
        id: true, orderNo: true, status: true, placedAt: true, shippedAt: true,
        totalCents: true, trackingCarrier: true, trackingNumber: true,
        lines: { select: { snapshotTitle: true, quantity: true } },
      },
    });

    return withCors(req, json({ orders }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
