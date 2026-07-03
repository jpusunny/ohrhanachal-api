import { z } from "zod";
import { getSession } from "@/lib/session";
import { json, parseBody, serverError } from "@/lib/api";
import {
  DEFAULT_EMAIL_SETTINGS, DEFAULT_ORDER_SETTINGS, DEFAULT_PAYMENT_SETTINGS,
  getEmailSettings, getOrderSettings, getPaymentSettings, writeSetting, writePaymentSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ error: "unauthorized" }, 401);
  const [email, orders, payments] = await Promise.all([
    getEmailSettings(), getOrderSettings(), getPaymentSettings(),
  ]);
  // Never leak SMTP password or xKeys back to the client — mask them.
  const maskedEmail = { ...email, smtpPass: email.smtpPass ? "•••••••" : "" };
  const maskedPayments = {
    ...payments,
    xKeySandbox: payments.xKeySandbox ? "•••••••" : "",
    xKeyLive:    payments.xKeyLive    ? "•••••••" : "",
  };
  return json({ email: maskedEmail, orders, payments: maskedPayments });
}

const emailBody = z.object({
  enabled: z.boolean(),
  ownerRecipients: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string(),
  smtpPass: z.string(),           // "" or "•••••••" means "don't change"
  smtpSecure: z.boolean(),
  fromAddress: z.string(),
  fromName: z.string(),
});

const orderBody = z.object({
  freeShippingOverCents: z.number().int().nonnegative(),
  flatShippingCents: z.number().int().nonnegative(),
});

const paymentBody = z.object({
  enabled: z.boolean(),
  mode: z.enum(["sandbox", "live"]),
  xKeySandbox: z.string(),       // "" or "•••••••" means "don't change"
  xKeyLive: z.string(),
  iFieldsKeySandbox: z.string(),
  iFieldsKeyLive: z.string(),
});

const bodySchema = z.object({
  email: emailBody.partial().optional(),
  orders: orderBody.partial().optional(),
  payments: paymentBody.partial().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    if (parsed.data.email) {
      const cur = await getEmailSettings();
      const inp = parsed.data.email;
      const next = { ...DEFAULT_EMAIL_SETTINGS, ...cur, ...inp } as typeof cur;
      // Keep the stored password if the caller sent the mask or an empty string.
      if (!inp.smtpPass || inp.smtpPass === "•••••••") next.smtpPass = cur.smtpPass;
      await writeSetting("email", next);
    }
    if (parsed.data.orders) {
      const cur = await getOrderSettings();
      const next = { ...DEFAULT_ORDER_SETTINGS, ...cur, ...parsed.data.orders };
      await writeSetting("orders", next);
    }
    if (parsed.data.payments) {
      const cur = await getPaymentSettings();
      const inp = parsed.data.payments;
      const next = { ...DEFAULT_PAYMENT_SETTINGS, ...cur, ...inp } as typeof cur;
      // Preserve stored xKeys if the caller sent an empty string or the mask.
      if (!inp.xKeySandbox || inp.xKeySandbox === "•••••••") next.xKeySandbox = cur.xKeySandbox;
      if (!inp.xKeyLive    || inp.xKeyLive    === "•••••••") next.xKeyLive    = cur.xKeyLive;
      await writePaymentSettings(next);
    }
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
