// Thin wrapper over the Cardknox public API. We use JSON responses via
// xResponseFormat=Json. Card data never touches this server — the storefront
// uses iFields to tokenize, and we charge the resulting xToken.
//
// Docs: https://kb.cardknox.com/api/

const GATEWAY = "https://x1.cardknox.com/gateway";
const SOFTWARE_NAME = "OhrHanachal";
const SOFTWARE_VERSION = "1.0";

export type ChargeInput = {
  xKey: string;
  amountCents: number;
  token: string;
  orderNo: string;
  customer: { name: string; email: string; phone?: string };
  ship: { street: string; city: string; state: string; zip: string; country?: string };
};

export type ChargeResult =
  | {
      ok: true;
      refNum: string;
      last4: string | null;
      brand: string | null;
      avs: string | null;
      cvv: string | null;
      raw: Record<string, unknown>;
    }
  | { ok: false; error: string; raw: Record<string, unknown> | null };

function form(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  return p.toString();
}

async function post(body: string): Promise<Record<string, unknown>> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  // Cardknox always returns 200 with an xResult field; a non-2xx would mean
  // network / auth-at-CDN trouble, so surface it.
  const text = await res.text();
  if (!res.ok) throw new Error(`Cardknox HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: parse form-encoded response if JSON was refused.
    const p: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text)) p[k] = v;
    return p;
  }
}

function amountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function charge(input: ChargeInput): Promise<ChargeResult> {
  const body = form({
    xKey: input.xKey,
    xVersion: "5.0.0",
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: "cc:sale",
    xResponseFormat: "Json",
    xAmount: amountString(input.amountCents),
    xToken: input.token,
    xInvoice: input.orderNo,
    xEmail: input.customer.email,
    xBillFirstName: input.customer.name.split(" ")[0] || input.customer.name,
    xBillLastName: input.customer.name.split(" ").slice(1).join(" ") || "",
    xStreet: input.ship.street,
    xCity: input.ship.city,
    xState: input.ship.state,
    xZip: input.ship.zip,
    xCountry: input.ship.country || "US",
  });

  let raw: Record<string, unknown>;
  try {
    raw = await post(body);
  } catch (e) {
    return { ok: false, error: (e as Error).message, raw: null };
  }

  const result = String(raw.xResult ?? "");
  const status = String(raw.xStatus ?? "");
  const approved = result === "A" || status === "Approved";
  if (!approved) {
    const err = String(raw.xError || raw.xStatus || raw.xResult || "Declined").trim();
    return { ok: false, error: err || "Declined", raw };
  }
  const masked = String(raw.xMaskedCardNumber || "");
  const last4 = masked ? masked.replace(/[^0-9]/g, "").slice(-4) : null;
  return {
    ok: true,
    refNum: String(raw.xRefNum ?? ""),
    last4,
    brand: raw.xCardType ? String(raw.xCardType) : null,
    avs: raw.xAvsResultCode ? String(raw.xAvsResultCode) : null,
    cvv: raw.xCvvResultCode ? String(raw.xCvvResultCode) : null,
    raw,
  };
}

// Test whether the xKey is accepted by the gateway. We send a cc:save with a
// syntactically-bad token; the response tells us whether the key was rejected
// (bad-key error) vs. the token was rejected (key is fine — expected).
export async function testConnection(xKey: string): Promise<{ ok: boolean; message: string; raw: Record<string, unknown> | null }> {
  const body = form({
    xKey,
    xVersion: "5.0.0",
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: "cc:save",
    xResponseFormat: "Json",
    xToken: "test-invalid-token-for-connection-check",
  });
  let raw: Record<string, unknown>;
  try {
    raw = await post(body);
  } catch (e) {
    return { ok: false, message: (e as Error).message, raw: null };
  }
  const err = String(raw.xError || "").toLowerCase();
  const keyRejected = /invalid.*(key|merchant)|not authorized|authentication/i.test(err);
  if (keyRejected) {
    return { ok: false, message: `Key rejected: ${raw.xError}`, raw };
  }
  // Token error is expected — that means the key was accepted.
  return {
    ok: true,
    message: `Gateway accepted the key (test token was rejected as expected: "${raw.xError || "no error text"}").`,
    raw,
  };
}
