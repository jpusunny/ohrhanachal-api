import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { getWholesaleSession } from "@/lib/wholesale-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

export async function GET(req: Request) {
  try {
    const sess = await getWholesaleSession();
    if (!sess) return withCors(req, json({ account: null }));
    const acct = await prisma.wholesaleAccount.findUnique({ where: { id: sess.sub } });
    if (!acct) return withCors(req, json({ account: null }));
    return withCors(req, json({
      account: {
        id: acct.id,
        email: acct.email,
        businessName: acct.businessName,
        contactName: acct.contactName,
        status: acct.status,
        ship: {
          street: acct.shipStreet, street2: acct.shipStreet2,
          city: acct.shipCity, state: acct.shipState, zip: acct.shipZip,
          country: acct.shipCountry,
        },
      },
    }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
