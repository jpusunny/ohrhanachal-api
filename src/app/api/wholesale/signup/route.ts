import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/cors";
import { json, parseBody, serverError } from "@/lib/api";
import { getEmailSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  phone: z.string().max(40).optional(),
  taxId: z.string().max(60).optional(),
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

    const existing = await prisma.wholesaleAccount.findUnique({ where: { email } });
    if (existing) {
      // Don't leak account existence — pretend success but do nothing.
      return withCors(req, json({ ok: true, status: "pending" }));
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const acct = await prisma.wholesaleAccount.create({
      data: {
        email,
        passwordHash,
        businessName: input.businessName,
        contactName: input.contactName,
        phone: input.phone || null,
        taxId: input.taxId || null,
        shipStreet:  input.ship?.street  || null,
        shipStreet2: input.ship?.street2 || null,
        shipCity:    input.ship?.city    || null,
        shipState:   input.ship?.state   || null,
        shipZip:     input.ship?.zip     || null,
        shipCountry: input.ship?.country || "United States",
        status: "pending",
      },
    });

    // Notify owners so they can approve.
    const owners = (await getEmailSettings()).ownerRecipients.split(",").map((s) => s.trim()).filter(Boolean);
    if (owners.length) {
      const html = `<p>New wholesale application from <strong>${esc(acct.businessName)}</strong> (${esc(acct.contactName)} &lt;${esc(acct.email)}&gt;${acct.phone ? ` — ${esc(acct.phone)}` : ""}).</p>
        <p>Review in admin → Wholesale.</p>`;
      sendEmail({ to: owners, subject: `Wholesale signup: ${acct.businessName}`, html }).catch((e) => console.error("[wholesale:signup:notify]", e));
    }

    return withCors(req, json({ ok: true, status: "pending", id: acct.id }, 201));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
