import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { json, serverError } from "@/lib/api";
import { applyPlan, buildPlan } from "@/lib/catalog-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

async function readCsv(req: Request): Promise<{ text: string; apply: boolean } | { error: string; status: number }> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const apply = form.get("apply") === "1";
    if (!(file instanceof File)) return { error: "missing_file", status: 400 };
    if (file.size === 0) return { error: "empty_file", status: 400 };
    if (file.size > MAX_CSV_BYTES) return { error: "too_large", status: 413 };
    return { text: await file.text(), apply };
  }
  const body = await req.json().catch(() => null) as { csv?: string; apply?: boolean } | null;
  if (!body || typeof body.csv !== "string") return { error: "missing_csv", status: 400 };
  if (body.csv.length > MAX_CSV_BYTES) return { error: "too_large", status: 413 };
  return { text: body.csv, apply: Boolean(body.apply) };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "unauthorized" }, 401);
    const parsed = await readCsv(req);
    if ("error" in parsed) return json({ error: parsed.error }, parsed.status);

    if (!parsed.apply) {
      const plan = await buildPlan(prisma, parsed.text);
      return json({ mode: "dry_run", plan });
    }
    const summary = await applyPlan(prisma, parsed.text, { actor: session.email });
    return json({ mode: "applied", summary });
  } catch (e) {
    return serverError(e);
  }
}
