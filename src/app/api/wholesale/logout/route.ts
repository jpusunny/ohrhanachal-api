import { withCors, corsPreflight } from "@/lib/cors";
import { json, serverError } from "@/lib/api";
import { clearWholesaleCookie } from "@/lib/wholesale-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) { return corsPreflight(req); }

export async function POST(req: Request) {
  try {
    await clearWholesaleCookie();
    return withCors(req, json({ ok: true }));
  } catch (e) {
    return withCors(req, serverError(e));
  }
}
