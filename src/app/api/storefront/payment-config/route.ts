import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

// Public: tells the storefront whether card payment is available and hands it
// the iFields key it needs to tokenize card data client-side. xKeys never leave
// this server.
export async function GET(req: Request) {
  try {
    const p = await getPaymentSettings();
    const iFieldsKey = p.mode === "live" ? p.iFieldsKeyLive : p.iFieldsKeySandbox;
    const xKey       = p.mode === "live" ? p.xKeyLive       : p.xKeySandbox;
    const enabled = p.enabled && !!xKey && !!iFieldsKey;
    return withCors(req, json({ enabled, mode: p.mode, iFieldsKey: enabled ? iFieldsKey : "" }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
