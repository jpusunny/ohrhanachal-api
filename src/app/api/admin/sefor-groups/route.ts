import { prisma } from "@/lib/prisma";
import { json, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Distinct seforGroup slugs across every non-null product, with member counts —
// used by the admin product form's group autocomplete.
export async function GET() {
  try {
    const rows = await prisma.product.groupBy({
      by: ["seforGroup"],
      where: { seforGroup: { not: null } },
      _count: true,
    });
    const groups = rows
      .map((r) => ({ slug: r.seforGroup!, count: r._count }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return json({ groups });
  } catch (e) {
    return serverError(e);
  }
}
