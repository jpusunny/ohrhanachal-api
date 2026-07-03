// Match the user-typed carrier string to a canonical carrier and build a
// public tracking URL. Kept as a single small file so future shipping code
// (labels, EasyPost) has one place to look.

export type Carrier = {
  code: "usps" | "ups" | "fedex" | "dhl" | "ontrac" | "other";
  label: string;
};

const CARRIERS: { match: RegExp; code: Carrier["code"]; label: string }[] = [
  { match: /^u\.?s\.?p\.?s\.?$|postal/i, code: "usps",   label: "USPS" },
  { match: /^u\.?p\.?s\.?$/i,             code: "ups",    label: "UPS" },
  { match: /fedex/i,                       code: "fedex",  label: "FedEx" },
  { match: /dhl/i,                         code: "dhl",    label: "DHL" },
  { match: /ontrac/i,                      code: "ontrac", label: "OnTrac" },
];

export function canonicalCarrier(raw: string | null | undefined): Carrier {
  const s = (raw || "").trim();
  if (!s) return { code: "other", label: "" };
  for (const c of CARRIERS) if (c.match.test(s)) return { code: c.code, label: c.label };
  return { code: "other", label: s };
}

export function trackingUrl(carrier: string | null | undefined, tracking: string | null | undefined): string | null {
  const t = (tracking || "").trim();
  if (!t) return null;
  const c = canonicalCarrier(carrier).code;
  const enc = encodeURIComponent(t);
  switch (c) {
    case "usps":   return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc}`;
    case "ups":    return `https://www.ups.com/track?tracknum=${enc}`;
    case "fedex":  return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
    case "dhl":    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${enc}`;
    case "ontrac": return `https://www.ontrac.com/tracking?number=${enc}`;
    default:       return null;
  }
}
