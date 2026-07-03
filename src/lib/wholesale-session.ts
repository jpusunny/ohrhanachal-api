// Wholesale customer session — separate cookie from the admin session so an
// admin doesn't inherit wholesale pricing (and vice-versa). Uses the same
// SESSION_SECRET but a distinct scope claim.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "ohr_wholesale";
const ALG = "HS256";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error("SESSION_SECRET missing or too short (>=24 chars)");
  return new TextEncoder().encode(s);
}

export type WholesalePayload = {
  sub: string;    // wholesale account id
  email: string;
  scope: "wholesale";
};

export async function signWholesale(payload: Omit<WholesalePayload, "scope">): Promise<string> {
  return await new SignJWT({ ...payload, scope: "wholesale" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyWholesale(token: string): Promise<WholesalePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.scope !== "wholesale") return null;
    return { sub: payload.sub, email: payload.email, scope: "wholesale" };
  } catch { return null; }
}

export const WHOLESALE_COOKIE = COOKIE;
export const WHOLESALE_TTL_SECONDS = TTL_SECONDS;

// The wholesale cookie has to be visible to BOTH the API subdomain
// (api.52.162.164.124.sslip.io) and the storefront subdomain
// (ohrhanachal.52.162.164.124.sslip.io) so SSR on the storefront can forward it
// to the API. We set Domain=52.162.164.124.sslip.io in production; leave it
// unset when running locally so both localhost:3000s stay independent.
const COOKIE_DOMAIN = process.env.COOKIE_PARENT_DOMAIN || undefined;

export async function setWholesaleCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: TTL_SECONDS,
  });
}

export async function clearWholesaleCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/", domain: COOKIE_DOMAIN, maxAge: 0 });
}

export async function getWholesaleSession(): Promise<WholesalePayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return await verifyWholesale(token);
}
