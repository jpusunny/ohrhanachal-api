import { sendEmail } from "@/lib/email";
import { getEmailSettings } from "@/lib/settings";
import { trackingUrl } from "@/lib/carriers";
import type { Order, OrderLine } from "@prisma/client";

type OrderWithLines = Order & { lines: OrderLine[] };

const STOREFRONT_BASE =
  process.env.STOREFRONT_BASE_URL || "http://ohrhanachal.52.162.164.124.sslip.io";

function money(cents: number) { return "$" + (cents / 100).toFixed(2); }

function esc(s: string | null | undefined) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function lineTable(lines: OrderLine[]) {
  const rows = lines.map((l) => `
    <tr>
      <td style="padding:8px 4px;border-top:1px solid #eee">
        <div>${esc(l.snapshotTitle)}${l.snapshotVariantName && l.snapshotVariantName !== "Default" ? ` — ${esc(l.snapshotVariantName)}` : ""}</div>
        <div style="color:#888;font-size:12px">SKU ${esc(l.snapshotSku)} · ×${l.quantity}</div>
      </td>
      <td style="padding:8px 4px;border-top:1px solid #eee;text-align:right;white-space:nowrap">
        ${money(l.lineTotalCents)}
      </td>
    </tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`;
}

function shipBlock(o: OrderWithLines) {
  return `
    <p style="margin:12px 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Shipping to</p>
    <div style="font-family:sans-serif;font-size:14px;line-height:1.5">
      ${esc(o.customerName)}<br/>
      ${esc(o.shipStreet)}${o.shipStreet2 ? "<br/>" + esc(o.shipStreet2) : ""}<br/>
      ${esc(o.shipCity)}, ${esc(o.shipState)} ${esc(o.shipZip)}<br/>
      ${esc(o.shipCountry)}
    </div>`;
}

function totalsBlock(o: OrderWithLines) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:4px 0;color:#666">Subtotal</td><td style="text-align:right">${money(o.subtotalCents)}</td></tr>
      <tr><td style="padding:4px 0;color:#666">Shipping</td><td style="text-align:right">${o.shippingCents === 0 ? "FREE" : money(o.shippingCents)}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #ccc;font-weight:600">Total</td><td style="text-align:right;padding:8px 0;border-top:1px solid #ccc;font-weight:600">${money(o.totalCents)}</td></tr>
    </table>`;
}

function baseTemplate(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f5f0">
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border:1px solid #eee">
      <p style="margin:0 0 12px;color:#8a6b1f;font-family:sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase">Ohr Hanachal Press</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#3a2517">${title}</h1>
      ${bodyHtml}
    </div>
  </body></html>`;
}

function lookupLink(o: Order) {
  const qs = new URLSearchParams({ orderNo: o.orderNo, email: o.customerEmail });
  return `${STOREFRONT_BASE}/confirmation?${qs.toString()}`;
}

export async function notifyOrderPlaced(order: OrderWithLines): Promise<void> {
  const customerHtml = baseTemplate(
    `Order ${order.orderNo} — thank you.`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.6">
       Thanks, ${esc(order.customerName)} — we&rsquo;ve got your order.
       We&rsquo;ll be in touch within one business day to confirm payment details;
       your seforim ship directly from the press once payment is arranged.
     </p>
     <p style="font-family:sans-serif;font-size:14px;color:#666">
       You picked: <strong>${prefLabel(order.paymentPref)}</strong>${order.customerNote ? `<br/>Your note: “${esc(order.customerNote)}”` : ""}
     </p>
     ${lineTable(order.lines)}
     ${totalsBlock(order)}
     ${shipBlock(order)}
     <p style="margin-top:24px;font-family:sans-serif;font-size:13px;color:#888">
       Look up your order any time: <a href="${lookupLink(order)}">${lookupLink(order)}</a>
     </p>`,
  );
  await sendEmail({ to: order.customerEmail, subject: `Ohr Hanachal — order ${order.orderNo}`, html: customerHtml });

  const owners = (await getEmailSettings()).ownerRecipients.split(",").map((s) => s.trim()).filter(Boolean);
  if (owners.length) {
    const ownerHtml = baseTemplate(
      `New order ${order.orderNo}`,
      `<p style="font-family:sans-serif;font-size:15px">
         ${esc(order.customerName)} &lt;${esc(order.customerEmail)}&gt;${order.customerPhone ? ` — ${esc(order.customerPhone)}` : ""}
         picked <strong>${prefLabel(order.paymentPref)}</strong>.
       </p>
       ${order.customerNote ? `<p style="font-family:sans-serif;font-size:14px;color:#555">Note: “${esc(order.customerNote)}”</p>` : ""}
       ${lineTable(order.lines)}
       ${totalsBlock(order)}
       ${shipBlock(order)}`,
    );
    await sendEmail({ to: owners, subject: `New order ${order.orderNo} — ${order.customerName}`, html: ownerHtml });
  }
}

export async function notifyOrderPaid(order: OrderWithLines): Promise<void> {
  const html = baseTemplate(
    `Payment received for ${order.orderNo}.`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.6">
       Thank you — we&rsquo;ve marked ${order.orderNo} as paid${order.paymentRecordedAs ? ` (${esc(order.paymentRecordedAs)})` : ""}.
       We&rsquo;ll ship as soon as possible; you&rsquo;ll get another email with tracking once it&rsquo;s on its way.
     </p>
     ${totalsBlock(order)}`,
  );
  await sendEmail({ to: order.customerEmail, subject: `Ohr Hanachal — payment received for ${order.orderNo}`, html });
}

export async function notifyOrderShipped(order: OrderWithLines): Promise<void> {
  const url = trackingUrl(order.trackingCarrier, order.trackingNumber);
  const tracking = order.trackingNumber
    ? `<p style="font-family:sans-serif;font-size:15px">Tracking: <strong>${esc(order.trackingCarrier)}</strong> · <code>${esc(order.trackingNumber)}</code>${url ? ` · <a href="${url}" style="color:#8a6b1f">Track your package →</a>` : ""}</p>`
    : "";
  const html = baseTemplate(
    `Order ${order.orderNo} is on its way.`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.6">
       Your seforim have shipped, ${esc(order.customerName)}.
     </p>${tracking}
     ${lineTable(order.lines)}
     ${shipBlock(order)}`,
  );
  await sendEmail({ to: order.customerEmail, subject: `Ohr Hanachal — ${order.orderNo} shipped`, html });
}

export async function notifyOrderCancelled(order: OrderWithLines): Promise<void> {
  const html = baseTemplate(
    `Order ${order.orderNo} was cancelled.`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.6">
       Your order ${order.orderNo} has been cancelled and any reserved seforim released.
       If this was a mistake, reply to this email and we&rsquo;ll put it back on the shelf.
     </p>`,
  );
  await sendEmail({ to: order.customerEmail, subject: `Ohr Hanachal — ${order.orderNo} cancelled`, html });
}

function prefLabel(p: string): string {
  return {
    contact_me: "Contact me for payment details",
    invoice: "Invoice me (check/wire)",
    phone: "I'll call in with my card",
    in_person: "Pay on pickup / delivery",
  }[p] || p;
}
