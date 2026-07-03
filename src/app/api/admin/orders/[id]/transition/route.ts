import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, parseBody, notFound, serverError } from "@/lib/api";
import {
  notifyOrderCancelled,
  notifyOrderPaid,
  notifyOrderShipped,
} from "@/lib/order-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), recordedAs: z.string().max(200).optional(), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("mark_shipped"), carrier: z.string().max(60), trackingNumber: z.string().max(120), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("mark_delivered"), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("cancel"), note: z.string().max(1000).optional() }),
]);

const NOTIFIABLE = new Set(["mark_paid", "mark_shipped", "cancel"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const { id } = await params;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;
    const input = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) return notFound();

    // Refuse illegal transitions rather than silently ignoring them.
    if (input.action === "mark_paid" && order.status !== "pending") {
      return json({ error: "bad_state", details: `already ${order.status}` }, 409);
    }
    if (input.action === "mark_shipped" && order.status !== "paid") {
      return json({ error: "bad_state", details: `must be paid first (currently ${order.status})` }, 409);
    }
    if (input.action === "mark_delivered" && order.status !== "shipped") {
      return json({ error: "bad_state", details: `must be shipped first (currently ${order.status})` }, 409);
    }
    if (input.action === "cancel" && (order.status === "shipped" || order.status === "delivered" || order.status === "cancelled")) {
      return json({ error: "bad_state", details: `cannot cancel a ${order.status} order` }, 409);
    }

    const now = new Date();
    const actor = `admin:${session.email}`;
    const updated = await prisma.$transaction(async (tx) => {
      if (input.action === "mark_paid") {
        await tx.order.update({
          where: { id },
          data: {
            status: "paid",
            paidAt: now,
            paymentRecordedAs: input.recordedAs || null,
          },
        });
        await tx.orderEvent.create({
          data: { orderId: id, kind: "paid", actor, body: input.recordedAs || input.note || null },
        });
      } else if (input.action === "mark_shipped") {
        // Decrement onHand + reserved for each line; write StockMovement rows.
        for (const line of order.lines) {
          await tx.inventoryLevel.update({
            where: { variantId: line.variantId },
            data: {
              onHand: { decrement: line.quantity },
              reserved: { decrement: line.quantity },
            },
          });
          await tx.stockMovement.create({
            data: {
              variantId: line.variantId,
              delta: -line.quantity,
              reason: "order",
              actor,
              note: `order ${order.orderNo}`,
            },
          });
        }
        await tx.order.update({
          where: { id },
          data: {
            status: "shipped",
            shippedAt: now,
            trackingCarrier: input.carrier,
            trackingNumber: input.trackingNumber,
          },
        });
        await tx.orderEvent.create({
          data: { orderId: id, kind: "shipped", actor, body: `${input.carrier} ${input.trackingNumber}${input.note ? ` — ${input.note}` : ""}` },
        });
      } else if (input.action === "mark_delivered") {
        await tx.order.update({
          where: { id },
          data: { status: "delivered", deliveredAt: now },
        });
        await tx.orderEvent.create({
          data: { orderId: id, kind: "delivered", actor, body: input.note || null },
        });
      } else if (input.action === "cancel") {
        // Release reservation only if we haven't shipped yet (already enforced above).
        for (const line of order.lines) {
          await tx.inventoryLevel.update({
            where: { variantId: line.variantId },
            data: { reserved: { decrement: line.quantity } },
          });
        }
        await tx.order.update({
          where: { id },
          data: { status: "cancelled", cancelledAt: now },
        });
        await tx.orderEvent.create({
          data: { orderId: id, kind: "cancelled", actor, body: input.note || null },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    });

    if (NOTIFIABLE.has(input.action)) {
      if (input.action === "mark_paid") notifyOrderPaid(updated).catch((e) => console.error(e));
      if (input.action === "mark_shipped") notifyOrderShipped(updated).catch((e) => console.error(e));
      if (input.action === "cancel") notifyOrderCancelled(updated).catch((e) => console.error(e));
    }

    return json({ order: { id: updated.id, status: updated.status } });
  } catch (e) {
    return serverError(e);
  }
}
