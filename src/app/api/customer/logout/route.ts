import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { clearCustomerCookie } from "@/lib/customer-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

export async function POST(req: Request) {
  try {
    await clearCustomerCookie();
    return withCors(req, json({ ok: true }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
