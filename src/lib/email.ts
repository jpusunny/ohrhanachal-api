import nodemailer from "nodemailer";
import { getEmailSettings, type EmailSettings } from "@/lib/settings";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; delivered: "console" };

/**
 * Best-effort email send. If SMTP is not configured or disabled, we log the
 * payload to stderr and return delivered:"console" so callers can note that.
 * We never throw — order-placement flows must not fail because email is broken.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const settings = await getEmailSettings();
  const to = Array.isArray(input.to) ? input.to.filter(Boolean).join(", ") : input.to;
  if (!to) return { ok: false, error: "no recipient", delivered: "console" };

  if (!settings.enabled || !settings.smtpHost || !settings.fromAddress) {
    console.log("[email:disabled]", JSON.stringify({ to, subject: input.subject }));
    return { ok: false, error: "email not configured", delivered: "console" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: settings.smtpUser
        ? { user: settings.smtpUser, pass: settings.smtpPass }
        : undefined,
    });
    const from = settings.fromName
      ? `"${settings.fromName}" <${settings.fromAddress}>`
      : settings.fromAddress;
    const info = await transporter.sendMail({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text || stripHtml(input.html),
    });
    return { ok: true, messageId: info.messageId ?? null };
  } catch (e) {
    console.error("[email:error]", (e as Error).message);
    return { ok: false, error: (e as Error).message, delivered: "console" };
  }
}

export async function verifySmtp(settings: EmailSettings): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass } : undefined,
    });
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
