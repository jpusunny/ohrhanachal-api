import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, notFound, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

// The customer looks up their own order with orderNo + email. Both must match.
export async function GET(req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  try {
    const { orderNo } = await params;
    const email = new URL(req.url).searchParams.get("email")?.toLowerCase();
    if (!email) return withCors(req, json({ error: "email_required" }, 400));

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        lines: { orderBy: { snapshotTitle: "asc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order || order.customerEmail !== email) return withCors(req, notFound());

    return withCors(
      req,
      json({
        order: {
          orderNo: order.orderNo,
          status: order.status,
          paymentPref: order.paymentPref,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          shipping: {
            street: order.shipStreet, street2: order.shipStreet2,
            city: order.shipCity, state: order.shipState,
            zip: order.shipZip, country: order.shipCountry,
          },
          customerNote: order.customerNote,
          placedAt: order.placedAt,
          paidAt: order.paidAt,
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
          cancelledAt: order.cancelledAt,
          subtotalCents: order.subtotalCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          trackingCarrier: order.trackingCarrier,
          trackingNumber: order.trackingNumber,
          lines: order.lines.map((l) => ({
            id: l.id,
            title: l.snapshotTitle,
            variantName: l.snapshotVariantName,
            sku: l.snapshotSku,
            handle: l.snapshotHandle,
            image: l.snapshotImageUrl,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            lineTotalCents: l.lineTotalCents,
          })),
          events: order.events
            .filter((e) => e.kind !== "note" || !e.body?.startsWith("[internal]"))
            .map((e) => ({ kind: e.kind, body: e.body, createdAt: e.createdAt })),
        },
      }),
    );
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
