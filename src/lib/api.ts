import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data as unknown as Record<string, unknown>, typeof init === "number" ? { status: init } : init);
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return json({ error: message, details }, 400);
}

export function notFound(message = "not_found"): NextResponse {
  return json({ error: message }, 404);
}

export function serverError(err: unknown): NextResponse {
  console.error("[api error]", err);
  return json({ error: "internal_error" }, 500);
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: badRequest("invalid_json") };
  }
  try {
    const data = schema.parse(body);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, res: badRequest("validation_error", e.flatten()) };
    return { ok: false, res: badRequest("validation_error") };
  }
}
