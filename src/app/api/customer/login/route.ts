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
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return withCors(req, parsed.res);
    const email = parsed.data.email.toLowerCase();

    const c = await prisma.customer.findUnique({ where: { email } });
    if (!c) return withCors(req, json({ error: "invalid_credentials" }, 401));

    const ok = await bcrypt.compare(parsed.data.password, c.passwordHash);
    if (!ok) return withCors(req, json({ error: "invalid_credentials" }, 401));

    const token = await signCustomer({ sub: c.id, email: c.email });
    await setCustomerCookie(token);
    return withCors(req, json({
      ok: true,
      customer: { id: c.id, email: c.email, name: c.name },
    }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
