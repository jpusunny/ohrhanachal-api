// Retail-customer session. Same JWT / cookie pattern as wholesale, distinct
// scope so we can't cross-authenticate between the two.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "ohr_customer";
const ALG = "HS256";
const TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error("SESSION_SECRET missing or too short (>=24 chars)");
  return new TextEncoder().encode(s);
}

export type CustomerPayload = { sub: string; email: string; scope: "customer" };

export async function signCustomer(payload: Omit<CustomerPayload, "scope">): Promise<string> {
  return await new SignJWT({ ...payload, scope: "customer" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyCustomer(token: string): Promise<CustomerPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.scope !== "customer") return null;
    return { sub: payload.sub, email: payload.email, scope: "customer" };
  } catch { return null; }
}

const COOKIE_DOMAIN = process.env.COOKIE_PARENT_DOMAIN || undefined;

export async function setCustomerCookie(token: string): Promise<void> {
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

export async function clearCustomerCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/", domain: COOKIE_DOMAIN, maxAge: 0 });
}

export async function getCustomerSession(): Promise<CustomerPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return await verifyCustomer(token);
}
