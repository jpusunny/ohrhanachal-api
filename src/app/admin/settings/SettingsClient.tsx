"use client";

import { useState } from "react";

type EmailSettings = {
  enabled: boolean;
  ownerRecipients: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromAddress: string;
  fromName: string;
};

type OrderSettings = {
  freeShippingOverCents: number;
  flatShippingCents: number;
};

type Initial = { email: EmailSettings; orders: OrderSettings };

export default function SettingsClient({ initial, me }: { initial: Initial; me: string }) {
  const [email, setEmail] = useState<EmailSettings>(initial.email);
  const [orders, setOrders] = useState<OrderSettings>(initial.orders);
  const [testTo, setTestTo] = useState(me);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, orders }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error || "Save failed."); return; }
      setMsg("Saved.");
      // Re-mask the password after successful save so the field doesn't send
      // a real password back on the next PUT.
      if (email.smtpPass && email.smtpPass !== "•••••••") {
        setEmail((e) => ({ ...e, smtpPass: "•••••••" }));
      }
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  async function testEmail() {
    setTestBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.details || body.error || "Test send failed."); return; }
      setMsg(`Sent to ${testTo}${body.messageId ? ` (id ${body.messageId})` : ""}.`);
    } catch { setErr("Network error."); } finally { setTestBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Email notifications</h2>
        <p className="mb-4 text-sm text-gray-600">
          When enabled, order placement / paid / shipped / cancelled events email the customer.
          Owner recipients also get a copy of new-order alerts.
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={email.enabled}
            onChange={(e) => setEmail({ ...email, enabled: e.target.checked })} />
          Send transactional emails
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <F label="Owner recipients (comma-separated)">
            <input type="text" value={email.ownerRecipients}
              onChange={(e) => setEmail({ ...email, ownerRecipients: e.target.value })}
              placeholder="you@ohrhanachal.com, ops@ohrhanachal.com"
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="From address">
            <input type="email" value={email.fromAddress}
              onChange={(e) => setEmail({ ...email, fromAddress: e.target.value })}
              placeholder="orders@ohrhanachal.com"
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="From display name">
            <input type="text" value={email.fromName}
              onChange={(e) => setEmail({ ...email, fromName: e.target.value })}
              placeholder="Ohr Hanachal Press"
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="SMTP host">
            <input type="text" value={email.smtpHost}
              onChange={(e) => setEmail({ ...email, smtpHost: e.target.value })}
              placeholder="smtp.postmarkapp.com"
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="SMTP port">
            <input type="number" value={email.smtpPort}
              onChange={(e) => setEmail({ ...email, smtpPort: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="TLS mode">
            <select value={email.smtpSecure ? "tls" : "starttls"}
              onChange={(e) => setEmail({ ...email, smtpSecure: e.target.value === "tls" })}
              className="w-full rounded border border-gray-300 px-3 py-2">
              <option value="starttls">STARTTLS (port 587)</option>
              <option value="tls">Implicit TLS (port 465)</option>
            </select>
          </F>
          <F label="SMTP user">
            <input type="text" value={email.smtpUser}
              onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
          <F label="SMTP password">
            <input type="password" value={email.smtpPass}
              onChange={(e) => setEmail({ ...email, smtpPass: e.target.value })}
              placeholder="unchanged"
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </F>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
            placeholder="send test to…" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={testEmail}
            disabled={testBusy || !testTo || !email.smtpHost || !email.fromAddress}
            className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            {testBusy ? "Sending…" : "Send test email"}
          </button>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Orders &amp; shipping</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Flat shipping (cents)">
            <input type="number" min={0} value={orders.flatShippingCents}
              onChange={(e) => setOrders({ ...orders, flatShippingCents: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-3 py-2" />
            <span className="text-xs text-gray-500">Currently ${(orders.flatShippingCents/100).toFixed(2)}</span>
          </F>
          <F label="Free shipping over (cents)">
            <input type="number" min={0} value={orders.freeShippingOverCents}
              onChange={(e) => setOrders({ ...orders, freeShippingOverCents: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-3 py-2" />
            <span className="text-xs text-gray-500">Currently ${(orders.freeShippingOverCents/100).toFixed(2)}</span>
          </F>
        </div>
      </section>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="sticky bottom-4 flex items-center gap-3 rounded border border-gray-300 bg-white p-3 shadow">
        <button type="button" onClick={save} disabled={busy}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-700">{label}</span>
      {children}
    </label>
  );
}
