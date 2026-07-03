import { z } from "zod";
import { getSession } from "@/lib/session";
import { json, parseBody, serverError } from "@/lib/api";
import { sendEmail } from "@/lib/email";
import { getEmailSettings, writeSetting, type EmailSettings } from "@/lib/settings";
import { verifySmtp } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    // Persist to force enabled=true only if the user hits Send — otherwise we
    // want the disabled flag to stick.
    const cur = await getEmailSettings();
    const forTest: EmailSettings = { ...cur, enabled: true };
    // We use verify() first to give a clean error before nodemailer's own send.
    const verify = await verifySmtp(forTest);
    if (!verify.ok) return json({ error: "smtp_verify_failed", details: verify.error }, 400);

    // Temporarily flip enabled for the send() call by re-writing the setting,
    // then restore. Cheaper than threading a runtime override through sendEmail.
    await writeSetting("email", forTest);
    let result;
    try {
      result = await sendEmail({
        to: parsed.data.to,
        subject: "Ohr Hanachal — SMTP test",
        html: `<p>This is a test message from the Ohr Hanachal admin. If you're seeing it, email is wired up.</p>
               <p style="color:#888;font-size:12px">Sent from ${cur.fromAddress || "(no from address)"} at ${new Date().toISOString()}</p>`,
      });
    } finally {
      await writeSetting("email", cur);
    }
    if (!result.ok) return json({ error: "send_failed", details: result.error }, 400);
    return json({ ok: true, messageId: result.messageId });
  } catch (e) {
    return serverError(e);
  }
}
