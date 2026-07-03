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
    if (!sess) return withCors(req, json({ customer: null }));
    const c = await prisma.customer.findUnique({ where: { id: sess.sub } });
    if (!c) return withCors(req, json({ customer: null }));
    return withCors(req, json({
      customer: {
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
        ship: {
          street: c.shipStreet, street2: c.shipStreet2,
          city: c.shipCity, state: c.shipState, zip: c.shipZip,
          country: c.shipCountry,
        },
      },
    }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
