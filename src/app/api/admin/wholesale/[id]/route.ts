import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, notFound, parseBody, serverError } from "@/lib/api";
import { getEmailSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(["pending", "approved", "suspended"]).optional(),
  internalNotes: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const { id } = await params;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    const acct = await prisma.wholesaleAccount.findUnique({ where: { id } });
    if (!acct) return notFound();

    const wasApproved = acct.status === "approved";
    const nextStatus = parsed.data.status ?? acct.status;
    const isNewApproval = nextStatus === "approved" && !wasApproved;

    const updated = await prisma.wholesaleAccount.update({
      where: { id },
      data: {
        status: nextStatus,
        internalNotes: parsed.data.internalNotes ?? acct.internalNotes,
        approvedAt: isNewApproval ? new Date() : acct.approvedAt,
        approvedBy: isNewApproval ? session.email : acct.approvedBy,
      },
    });

    if (isNewApproval) {
      const settings = await getEmailSettings();
      if (settings.enabled) {
        sendEmail({
          to: updated.email,
          subject: "Your Ohr Hanachal wholesale account is active",
          html: `<p>Hi ${esc(updated.contactName)},</p>
            <p>Your wholesale account for <strong>${esc(updated.businessName)}</strong> is approved.
            Sign in at the storefront and you'll see wholesale pricing on the catalog and checkout.
            Orders will be invoiced (net-30).</p>
            <p>— Ohr Hanachal Press</p>`,
        }).catch((e) => console.error("[wholesale:approve:notify]", e));
      }
    }

    return json({ ok: true, account: { id: updated.id, status: updated.status } });
  } catch (e) {
    return serverError(e);
  }
}

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
