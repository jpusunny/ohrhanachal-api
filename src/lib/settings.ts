import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export type EmailSettings = {
  enabled: boolean;
  ownerRecipients: string;   // comma-separated
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromAddress: string;
  fromName: string;
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  ownerRecipients: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  smtpSecure: false,
  fromAddress: "",
  fromName: "Ohr Hanachal",
};

export type OrderSettings = {
  freeShippingOverCents: number;
  flatShippingCents: number;
};

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  freeShippingOverCents: 7500,
  flatShippingCents: 695,
};

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

export async function writeSetting<T>(key: string, value: T): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export function getEmailSettings(): Promise<EmailSettings> {
  return readSetting<EmailSettings>("email", DEFAULT_EMAIL_SETTINGS);
}

export function getOrderSettings(): Promise<OrderSettings> {
  return readSetting<OrderSettings>("orders", DEFAULT_ORDER_SETTINGS);
}

// Payments (Sola via Cardknox). xKey_* are stored encrypted; iFieldsKey_* are
// public (embedded in browser) so plaintext is fine.
export type PaymentSettings = {
  enabled: boolean;
  mode: "sandbox" | "live";
  xKeySandbox: string;      // encrypted at rest
  xKeyLive: string;         // encrypted at rest
  iFieldsKeySandbox: string;
  iFieldsKeyLive: string;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  enabled: false,
  mode: "sandbox",
  xKeySandbox: "",
  xKeyLive: "",
  iFieldsKeySandbox: "",
  iFieldsKeyLive: "",
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const raw = await readSetting<PaymentSettings>("payments", DEFAULT_PAYMENT_SETTINGS);
  return {
    ...raw,
    xKeySandbox: raw.xKeySandbox ? decryptSecret(raw.xKeySandbox) : "",
    xKeyLive:    raw.xKeyLive    ? decryptSecret(raw.xKeyLive)    : "",
  };
}

export async function writePaymentSettings(next: PaymentSettings): Promise<void> {
  const encrypted: PaymentSettings = {
    ...next,
    xKeySandbox: next.xKeySandbox ? encryptSecret(next.xKeySandbox) : "",
    xKeyLive:    next.xKeyLive    ? encryptSecret(next.xKeyLive)    : "",
  };
  await writeSetting("payments", encrypted);
}

// Convenience — returns the active xKey for the current mode (empty string if
// not configured). Callers use this to decide whether card payment is available.
export async function getActiveXKey(): Promise<{ key: string; mode: "sandbox" | "live" }> {
  const p = await getPaymentSettings();
  if (!p.enabled) return { key: "", mode: p.mode };
  const key = p.mode === "live" ? p.xKeyLive : p.xKeySandbox;
  return { key, mode: p.mode };
}
