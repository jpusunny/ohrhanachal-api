// Helpers for treating a request as wholesale-priced or not.

import { prisma } from "@/lib/prisma";
import { getWholesaleSession } from "@/lib/wholesale-session";

// True iff the current request has a valid wholesale session for an *approved*
// account. Suspended and pending accounts still authenticate but see retail
// prices — visibility should not depend on approval, purchasing power should.
export async function isWholesaleContext(): Promise<{ ok: boolean; accountId: string | null }> {
  const sess = await getWholesaleSession();
  if (!sess) return { ok: false, accountId: null };
  const acct = await prisma.wholesaleAccount.findUnique({
    where: { id: sess.sub },
    select: { status: true },
  });
  if (!acct || acct.status !== "approved") return { ok: false, accountId: sess.sub };
  return { ok: true, accountId: sess.sub };
}

// Pick the price the caller should pay for a variant given their context.
export function pickPriceCents(
  v: { priceCents: number; wholesalePriceCents: number | null },
  wholesale: boolean,
): number {
  return wholesale && v.wholesalePriceCents != null ? v.wholesalePriceCents : v.priceCents;
}
