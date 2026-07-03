import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, parseBody, serverError } from "@/lib/api";
import { signCustomer, setCustomerCookie } from "@/lib/customer-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
  phone: z.string().max(40).optional(),
  ship: z.object({
    street: z.string().max(200).optional(),
    street2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    zip: z.string().max(40).optional(),
    country: z.string().max(80).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return withCors(req, parsed.res);
    const input = parsed.data;
    const email = input.email.toLowerCase();

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) return withCors(req, json({ error: "email_in_use" }, 409));

    const passwordHash = await bcrypt.hash(input.password, 10);
    const created = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        name: input.name,
        phone: input.phone || null,
        shipStreet:  input.ship?.street  || null,
        shipStreet2: input.ship?.street2 || null,
        shipCity:    input.ship?.city    || null,
        shipState:   input.ship?.state   || null,
        shipZip:     input.ship?.zip     || null,
        shipCountry: input.ship?.country || "United States",
      },
    });

    // Retro-link past guest orders that used the same email. Best-effort — a
    // seforim press has a small, direct customer base and email == identity is
    // a reasonable assumption; if abuse ever shows up we can add verification.
    const linked = await prisma.order.updateMany({
      where: { customerEmail: email, customerId: null },
      data: { customerId: created.id },
    });

    const token = await signCustomer({ sub: created.id, email: created.email });
    await setCustomerCookie(token);

    return withCors(req, json({
      ok: true,
      customer: { id: created.id, email: created.email, name: created.name },
      linkedOrders: linked.count,
    }, 201));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
