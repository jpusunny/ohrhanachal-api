"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PriceRow = {
  variantId: string;
  productTitle: string;
  productHandle: string;
  variantName: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  authorGroup: string;
  seforGroup: string | null;
};

type Mode = "percent" | "flat_cents" | "set_cents";
type Round = "cent" | "nine" | "none";

function money(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function preview(cents: number, mode: Mode, value: number, round: Round): number {
  const raw = mode === "percent"
    ? cents * (1 + value / 100)
    : mode === "flat_cents"
      ? cents + value
      : value;
  if (round === "none") return Math.max(0, Math.round(raw));
  if (round === "nine") {
    const dollars = Math.max(0, Math.round(raw / 100));
    return dollars * 100 - 1 < 0 ? 0 : dollars * 100 - 1;
  }
  return Math.max(0, Math.round(raw));
}

export default function BulkPriceForm({ rows }: { rows: PriceRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("percent");
  const [valueStr, setValueStr] = useState("10");
  const [round, setRound] = useState<Round>("cent");
  const [q, setQ] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const value = Number(valueStr);
  const valueValid = Number.isFinite(value);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (seriesFilter !== "all" && r.authorGroup !== seriesFilter) return false;
      if (!search) return true;
      return (
        r.productTitle.toLowerCase().includes(search) ||
        r.sku.toLowerCase().includes(search) ||
        r.variantName.toLowerCase().includes(search) ||
        r.productHandle.includes(search) ||
        (r.seforGroup || "").includes(search)
      );
    });
  }, [rows, q, seriesFilter]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visible = filtered.map((r) => r.variantId);
    const allSelected = visible.every((id) => selected.has(id));
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) visible.forEach((id) => next.delete(id));
      else visible.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedRows = rows.filter((r) => selected.has(r.variantId));
  const changes = valueValid
    ? selectedRows.map((r) => ({
        variantId: r.variantId,
        from: r.priceCents,
        to: preview(r.priceCents, mode, value, round),
      }))
    : [];
  const changeCount = changes.filter((c) => c.from !== c.to).length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    if (selected.size === 0) { setErr("Select at least one variant."); return; }
    if (!valueValid) { setErr("Enter a numeric value."); return; }
    if (!confirm(`Apply ${mode === "percent" ? `${value}%` : mode === "flat_cents" ? `${value}¢` : `set to ${money(value)}`} to ${selected.size} variant${selected.size === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bulk-price", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, value, variantIds: Array.from(selected), round }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error || "Failed."); return; }
      setOkMsg(`Updated ${body.updated} variant${body.updated === 1 ? "" : "s"}.`);
      setSelected(new Set());
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded border border-gray-300 px-3 py-2">
              <option value="percent">Percent change</option>
              <option value="flat_cents">Flat cents (add / subtract)</option>
              <option value="set_cents">Set to (cents)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">
              Value {mode === "percent" ? "(%)" : "(cents)"}
            </span>
            <input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2" step="1" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Rounding</span>
            <select value={round} onChange={(e) => setRound(e.target.value as Round)}
              className="w-full rounded border border-gray-300 px-3 py-2">
              <option value="cent">Nearest cent</option>
              <option value="nine">Nearest x.99</option>
              <option value="none">No rounding</option>
            </select>
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-gray-700">Selection</span>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              {selected.size} of {rows.length} · {changeCount} will change
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Filter title, SKU, handle, group…"
          value={q} onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[240px] rounded border border-gray-300 px-3 py-2 text-sm" />
        <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All series</option>
          <option value="nachman">R&apos; Nachman</option>
          <option value="nossen">R&apos; Nossen</option>
          <option value="anash">Anash</option>
          <option value="set">Sets</option>
          <option value="other">Other</option>
        </select>
        <button type="button" onClick={toggleAll}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          {filtered.every((r) => selected.has(r.variantId)) ? "Deselect visible" : "Select visible"}
        </button>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Product / Variant</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">New</th>
              <th className="px-3 py-2 text-right">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => {
              const isSel = selected.has(r.variantId);
              const newPrice = isSel && valueValid ? preview(r.priceCents, mode, value, round) : r.priceCents;
              const delta = newPrice - r.priceCents;
              return (
                <tr key={r.variantId} className={isSel ? "bg-yellow-50/60" : ""}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(r.variantId)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.productTitle}</div>
                    <div className="text-xs text-gray-500">{r.variantName}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 text-right">{money(r.priceCents)}</td>
                  <td className={"px-3 py-2 text-right " + (isSel && delta !== 0 ? "font-semibold" : "text-gray-400")}>
                    {isSel ? money(newPrice) : "—"}
                  </td>
                  <td className={"px-3 py-2 text-right " + (delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-gray-400")}>
                    {isSel && delta !== 0 ? (delta > 0 ? "+" : "") + money(delta) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

      <div className="sticky bottom-4 flex items-center gap-3 rounded border border-gray-300 bg-white p-3 shadow">
        <button type="submit" disabled={busy || selected.size === 0 || changeCount === 0}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {busy ? "Applying…" : `Apply to ${selected.size} variant${selected.size === 1 ? "" : "s"}`}
        </button>
        <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0 || busy}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
          Clear selection
        </button>
      </div>
    </form>
  );
}
