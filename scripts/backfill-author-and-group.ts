import { PrismaClient, AuthorGroup } from "@prisma/client";
import { readFileSync } from "node:fs";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "", inQuotes = false;
  let record: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i+1]==='"'){field+='"'; i++;} else inQuotes=false; } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n") { record.push(field); rows.push(record); record = []; field = ""; }
    else if (c === "\r") {} else field += c;
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }
  const [header, ...data] = rows;
  return data.filter((r) => r.some((v) => v !== "")).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as Row);
}

// Map from Shopify handle (family key) → { author, seforGroup, seforTitle }.
// seforGroup is the family slug (all format-variants share it).
// The rules are conservative — anything unmatched stays authorGroup="other" so the
// admin can curate. Ordering matters: check "set" and specific families before
// generic pocket/leather modifiers.
type Rule = { rx: RegExp; author: AuthorGroup; group: string };
const RULES: Rule[] = [
  // R' Nachman — the yesod texts
  { rx: /^likutei-moharan/, author: "nachman", group: "likutei-moharan" },
  { rx: /^sipurei-masiyos|^sipurei-maasiyos/, author: "nachman", group: "sipurei-masiyos" },
  { rx: /^sichos-haran|^siches-haran/, author: "nachman", group: "sichos-haran" },
  { rx: /^chayei-moharan/, author: "nachman", group: "chayei-moharan" },
  { rx: /^sefer-hamidos|^sefer-hamiddos/, author: "nachman", group: "sefer-hamidos" },
  { rx: /^kitzur.*moharan/, author: "nachman", group: "kitzur-likutei-moharan" },
  { rx: /^tikkun-klali/, author: "nachman", group: "tikkun-klali" },
  { rx: /^shivchei/, author: "nachman", group: "shivchei-haran" },
  { rx: /^likitei-maran/, author: "nachman", group: "likitei-maran" },

  // R' Nossen
  { rx: /^likutei-halachos/, author: "nossen", group: "likutei-halachos" },
  { rx: /^likutei-tefilos/, author: "nossen", group: "likutei-tefilos" },
  { rx: /^likutei-eitzos/, author: "nossen", group: "likutei-eitzos" },
  { rx: /^alim-letrufah/, author: "nossen", group: "alim-letrufah" },
  { rx: /^hishtapchus|^hishtapchus-hanefesh/, author: "nossen", group: "hishtapchus-meshivas-nefesh" },
  { rx: /^meshivas-nefesh/, author: "nossen", group: "hishtapchus-meshivas-nefesh" },
  { rx: /^betzina-kadisha/, author: "nossen", group: "betzina-kadisha" },

  // Sifrei Anash
  { rx: /^kochvei-ohr/, author: "anash", group: "kochvei-ohr" },
  { rx: /^shemos-hatzadikum|^shemos-hatzadikim/, author: "anash", group: "shemos-hatzadikim" },

  // Sets and bundles
  { rx: /^set-sifrei-breslev/, author: "set", group: "set-sifrei-breslev" },
  { rx: /^set-likutei-moharan/, author: "set", group: "set-likutei-moharan" },
  { rx: /^set-alim-letrufah/, author: "set", group: "set-alim-letrufah" },
  { rx: /^set-/, author: "set", group: "" }, // fallback: any "set-*" is a Set, group = handle
];

function classify(handle: string): { author: AuthorGroup; group: string } {
  for (const r of RULES) {
    if (r.rx.test(handle)) {
      return { author: r.author, group: r.group || handle };
    }
  }
  return { author: "other", group: handle };
}

function titleize(slug: string): string {
  return slug
    .replace(/^set-/, "Set ")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const file = process.env.CATALOG_CSV || "/home/azureuser/work/catalog.csv";
  const csvRows = parseCsv(readFileSync(file, "utf8"));
  const tagsByHandle = new Map<string, string[]>();
  for (const r of csvRows) {
    if (r["Handle"] && r["Tags"]) tagsByHandle.set(r["Handle"], r["Tags"].split(",").map((t) => t.trim()));
  }

  const prisma = new PrismaClient();
  const summary = { updated: 0, unchanged: 0, byAuthor: {} as Record<string, number>, byGroup: {} as Record<string, number> };
  try {
    const products = await prisma.product.findMany({ orderBy: { handle: "asc" } });
    for (const p of products) {
      const { author, group } = classify(p.handle);
      const changed = p.authorGroup !== author || p.seforGroup !== group;
      if (!changed) { summary.unchanged++; continue; }
      await prisma.product.update({
        where: { id: p.id },
        data: { authorGroup: author, seforGroup: group },
      });
      summary.updated++;
      summary.byAuthor[author] = (summary.byAuthor[author] || 0) + 1;
      summary.byGroup[group] = (summary.byGroup[group] || 0) + 1;
      console.log(`[set] ${p.handle.padEnd(52)} → ${author.padEnd(8)} group=${group}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  const distinctGroups = Object.keys(summary.byGroup).length;
  console.log("\n[backfill] summary");
  console.log(JSON.stringify({ ...summary, distinctGroups }, null, 2));

  // Anything still labeled "other" is worth flagging
  const orphan = await new PrismaClient();
  try {
    const others = await orphan.product.findMany({ where: { authorGroup: "other" }, select: { handle: true, title: true } });
    if (others.length) {
      console.log(`\n[backfill] ${others.length} products still authorGroup="other" — assign in admin:`);
      for (const o of others) console.log(`  - ${o.handle} — ${o.title}`);
    }
  } finally {
    await orphan.$disconnect();
  }

  void titleize; void tagsByHandle; // reserved for follow-up UI tweaks
}

main().catch((e) => { console.error(e); process.exit(1); });
