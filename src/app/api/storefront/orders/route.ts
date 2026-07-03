import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, parseBody, serverError } from "@/lib/api";
import { getActiveXKey, getOrderSettings } from "@/lib/settings";
import { charge } from "@/lib/cardknox";
import { isWholesaleContext, pickPriceCents } from "@/lib/wholesale";
import { getCustomerSession, signCustomer, setCustomerCookie } from "@/lib/customer-session";
import { notifyOrderPaid, notifyOrderPlaced } from "@/lib/order-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

const lineInput = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(9999),
});

const bodySchema = z.object({
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    phone: z.string().max(40).optional(),
  }),
  shipping: z.object({
    street: z.string().min(1),
    street2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().default("United States"),
  }),
  paymentPref: z.enum(["contact_me", "invoice", "phone", "in_person", "card"]),
  cardknoxToken: z.string().min(1).max(500).optional(),
  // Optional: create a retail customer account with this order. Guest checkout
  // stays the default; this is opt-in via a checkbox on the storefront.
  createAccountPassword: z.string().min(8).max(200).optional(),
  note: z.string().max(2000).optional(),
  lines: z.array(lineInput).min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return withCors(req, parsed.res);
    const input = parsed.data;

    const { ok: wholesale, accountId: wholesaleAccountId } = await isWholesaleContext();
    const customerSess = await getCustomerSession();

    // Load variants with inventory in one shot, verify still available.
    const variants = await prisma.variant.findMany({
      where: { id: { in: input.lines.map((l) => l.variantId) } },
      include: {
        inventory: true,
        product: {
          select: { title: true, handle: true, status: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
        },
      },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    // Validate every line & compute totals from server-side prices only.
    let subtotal = 0;
    const prepared: {
      variantId: string; qty: number; unit: number; lineTotal: number;
      snapshotTitle: string; snapshotSku: string; snapshotHandle: string;
      snapshotVariantName: string; snapshotImageUrl: string | null;
    }[] = [];
    const unavailable: { variantId: string; reason: string }[] = [];
    for (const l of input.lines) {
      const v = byId.get(l.variantId);
      if (!v) { unavailable.push({ variantId: l.variantId, reason: "not_found" }); continue; }
      if (!v.active || v.product.status !== "active") {
        unavailable.push({ variantId: l.variantId, reason: "not_for_sale" }); continue;
      }
      const onHand = v.inventory?.onHand ?? 0;
      const reserved = v.inventory?.reserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      if (available < l.quantity) {
        unavailable.push({ variantId: l.variantId, reason: `only ${available} in stock` }); continue;
      }
      const unit = pickPriceCents(v, wholesale);
      const lineTotal = unit * l.quantity;
      subtotal += lineTotal;
      prepared.push({
        variantId: v.id,
        qty: l.quantity,
        unit,
        lineTotal,
        snapshotTitle: v.product.title,
        snapshotSku: v.sku,
        snapshotHandle: v.product.handle,
        snapshotVariantName: v.name,
        snapshotImageUrl: v.product.images[0]?.url ?? null,
      });
    }
    if (unavailable.length) {
      return withCors(req, json({ error: "unavailable", unavailable }, 409));
    }

    const settings = await getOrderSettings();
    const shippingCents =
      subtotal >= settings.freeShippingOverCents ? 0 : settings.flatShippingCents;
    const total = subtotal + shippingCents;

    // Wholesale customers pay on invoice (net-30) — no card capture. Force it.
    const effectivePref: typeof input.paymentPref = wholesale ? "invoice" : input.paymentPref;

    // If the customer picked "card", we need a Cardknox token AND card payments
    // must be enabled + configured. Charge FIRST, then create the order. This
    // means a declined card never allocates an orderNo or reserves stock.
    let cardResult: Awaited<ReturnType<typeof charge>> | null = null;
    if (effectivePref === "card") {
      if (!input.cardknoxToken) {
        return withCors(req, json({ error: "missing_card_token" }, 400));
      }
      const { key: xKey } = await getActiveXKey();
      if (!xKey) {
        return withCors(req, json({ error: "card_payments_disabled" }, 400));
      }
      cardResult = await charge({
        xKey,
        amountCents: total,
        token: input.cardknoxToken,
        orderNo: `PENDING`,
        customer: input.customer,
        ship: {
          street: input.shipping.street,
          city: input.shipping.city,
          state: input.shipping.state,
          zip: input.shipping.zip,
          country: input.shipping.country,
        },
      });
      if (!cardResult.ok) {
        return withCors(req, json({ error: "card_declined", details: cardResult.error }, 402));
      }
    }

    // Transactionally: allocate orderNo, insert Order + lines, bump reserved on each variant.
    const created = await prisma.$transaction(async (tx) => {
      const seq = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
        `SELECT nextval('order_no_seq') AS nextval`,
      );
      const orderNo = `OH-${seq[0].nextval}`;
      const order = await tx.order.create({
        data: {
          orderNo,
          status: cardResult ? "paid" : "pending",
          paidAt: cardResult ? new Date() : null,
          channel: wholesale ? "wholesale" : "web",
          wholesaleAccountId: wholesale ? wholesaleAccountId : null,
          customerId: customerSess?.sub ?? null,
          paymentPref: effectivePref,
          customerEmail: input.customer.email.toLowerCase(),
          customerName: input.customer.name,
          customerPhone: input.customer.phone || null,
          shipStreet: input.shipping.street,
          shipStreet2: input.shipping.street2 || null,
          shipCity: input.shipping.city,
          shipState: input.shipping.state,
          shipZip: input.shipping.zip,
          shipCountry: input.shipping.country || "United States",
          customerNote: input.note || null,
          subtotalCents: subtotal,
          shippingCents,
          totalCents: total,
          paymentRecordedAs: cardResult ? `Cardknox ${cardResult.brand || "card"} ****${cardResult.last4 || "----"} (ref ${cardResult.refNum})` : null,
          cardknoxRefNum: cardResult?.refNum ?? null,
          cardknoxLast4:  cardResult?.last4 ?? null,
          cardknoxBrand:  cardResult?.brand ?? null,
          cardknoxAvsCode: cardResult?.avs ?? null,
          cardknoxCvvCode: cardResult?.cvv ?? null,
        },
      });
      await tx.orderLine.createMany({
        data: prepared.map((p) => ({
          orderId: order.id,
          variantId: p.variantId,
          quantity: p.qty,
          unitPriceCents: p.unit,
          lineTotalCents: p.lineTotal,
          snapshotTitle: p.snapshotTitle,
          snapshotSku: p.snapshotSku,
          snapshotHandle: p.snapshotHandle,
          snapshotVariantName: p.snapshotVariantName,
          snapshotImageUrl: p.snapshotImageUrl,
        })),
      });
      for (const p of prepared) {
        await tx.inventoryLevel.upsert({
          where: { variantId: p.variantId },
          create: { variantId: p.variantId, onHand: 0, reserved: p.qty },
          update: { reserved: { increment: p.qty } },
        });
      }
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          kind: "placed",
          actor: wholesale ? `wholesale:${order.customerEmail}` : `customer:${order.customerEmail}`,
          body: `Placed via ${effectivePref}${wholesale ? " (wholesale)" : ""}`,
        },
      });
      if (cardResult) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            kind: "paid",
            actor: `customer:${order.customerEmail}`,
            body: `Cardknox ${cardResult.brand || "card"} ****${cardResult.last4 || "----"} — ref ${cardResult.refNum}`,
          },
        });
      }
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
    });

    // If the guest asked us to save their details, provision a customer
    // account with the shipping address they just typed and retro-link this
    // order (plus any prior guest orders using the same email). Silent no-op
    // if the email is already claimed — we don't leak account existence.
    if (!customerSess && !wholesale && input.createAccountPassword) {
      const email = input.customer.email.toLowerCase();
      const existing = await prisma.customer.findUnique({ where: { email } });
      if (!existing) {
        try {
          const passwordHash = await bcrypt.hash(input.createAccountPassword, 10);
          const newCustomer = await prisma.customer.create({
            data: {
              email,
              passwordHash,
              name: input.customer.name,
              phone: input.customer.phone || null,
              shipStreet:  input.shipping.street,
              shipStreet2: input.shipping.street2 || null,
              shipCity:    input.shipping.city,
              shipState:   input.shipping.state,
              shipZip:     input.shipping.zip,
              shipCountry: input.shipping.country || "United States",
            },
          });
          await prisma.order.updateMany({
            where: { customerEmail: email, customerId: null },
            data: { customerId: newCustomer.id },
          });
          const token = await signCustomer({ sub: newCustomer.id, email: newCustomer.email });
          await setCustomerCookie(token);
        } catch (e) {
          console.error("[checkout:create-account]", e);
        }
      }
    }

    // Fire notifications after the transaction commits. Do not block on failure.
    notifyOrderPlaced(created).catch((e) => console.error("[notify:placed]", e));
    if (cardResult) {
      notifyOrderPaid(created).catch((e) => console.error("[notify:paid]", e));
    }

    return withCors(
      req,
      json({
        orderNo: created.orderNo,
        status: created.status,
        totalCents: created.totalCents,
      }, 201),
    );
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
