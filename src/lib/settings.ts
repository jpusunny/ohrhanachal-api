import { prisma } from "@/lib/prisma";

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
