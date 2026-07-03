import { z } from "zod";
import { getSession } from "@/lib/session";
import { json, parseBody, serverError } from "@/lib/api";
import { getPaymentSettings } from "@/lib/settings";
import { testConnection } from "@/lib/cardknox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ mode: z.enum(["sandbox", "live"]) });

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.res;

    const p = await getPaymentSettings();
    const key = parsed.data.mode === "live" ? p.xKeyLive : p.xKeySandbox;
    if (!key) return json({ error: `No ${parsed.data.mode} xKey configured. Save one first.` }, 400);

    const result = await testConnection(key);
    return json(result);
  } catch (e) {
    return serverError(e);
  }
}
