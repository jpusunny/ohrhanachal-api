import { NextResponse } from "next/server";

const RAW = process.env.STOREFRONT_ORIGINS || "";
const CONFIGURED = RAW.split(",").map((s) => s.trim()).filter(Boolean);

function pickOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (!origin) return "*";
  if (CONFIGURED.length === 0) return origin;
  return CONFIGURED.includes(origin) ? origin : CONFIGURED[0];
}

export function withCors(req: Request, res: NextResponse): NextResponse {
  const origin = pickOrigin(req);
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function corsPreflight(req: Request): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}
