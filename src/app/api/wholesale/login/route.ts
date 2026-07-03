import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, parseBody, serverError } from "@/lib/api";
import { signWholesale, setWholesaleCookie } from "@/lib/wholesale-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return withCors(req, parsed.res);
    const email = parsed.data.email.toLowerCase();

    const acct = await prisma.wholesaleAccount.findUnique({ where: { email } });
    if (!acct) return withCors(req, json({ error: "invalid_credentials" }, 401));

    const ok = await bcrypt.compare(parsed.data.password, acct.passwordHash);
    if (!ok) return withCors(req, json({ error: "invalid_credentials" }, 401));

    if (acct.status === "suspended") return withCors(req, json({ error: "account_suspended" }, 403));

    const token = await signWholesale({ sub: acct.id, email: acct.email });
    await setWholesaleCookie(token);
    return withCors(req, json({
      ok: true,
      status: acct.status,
      account: {
        id: acct.id,
        email: acct.email,
        businessName: acct.businessName,
        contactName: acct.contactName,
        status: acct.status,
      },
    }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
