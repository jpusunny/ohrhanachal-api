import Link from "next/link";
import SettingsClient from "./SettingsClient";
import { getEmailSettings, getOrderSettings } from "@/lib/settings";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [email, orders, session] = await Promise.all([
    getEmailSettings(),
    getOrderSettings(),
    getSession(),
  ]);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/admin/products" className="text-sm text-gray-600 hover:underline">
          ← Back to products
        </Link>
      </div>
      <SettingsClient
        initial={{
          email: { ...email, smtpPass: email.smtpPass ? "•••••••" : "" },
          orders,
        }}
        me={session?.email ?? ""}
      />
    </div>
  );
}
