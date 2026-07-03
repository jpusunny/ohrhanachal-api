"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type BulkVariantRow = {
  variantId: string;
  productId: string;
  productTitle: string;
  productHandle: string;
  variantName: string;
  sku: string;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
  authorGroup: string;
  seforGroup: string | null;
};

const REASONS = [
  { value: "initial", label: "Initial stock" },
  { value: "manual_adjustment", label: "Manual adjustment" },
  { value: "order", label: "Order fulfillment" },
  { value: "return", label: "Return" },
  { value: "correction", label: "Correction" },
] as const;

type ReasonValue = (typeof REASONS)[number]["value"];

export default function BulkStockForm({ rows }: { rows: BulkVariantRow[] }) {
  const router = useRouter();
  const [reason, setReason] = useState<ReasonValue>("initial");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

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

  const nonZero = Object.entries(deltas).flatMap(([variantId, raw]) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0) return [];
    return [{ variantId, delta: Math.trunc(n) }];
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    if (nonZero.length === 0) {
      setErr("Enter at least one non-zero delta.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bulk-stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, note: note.trim() || undefined, entries: nonZero }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.details || body.error || "Save failed.");
        return;
      }
      setOkMsg(`Applied ${body.applied.length} change(s) · batch ${body.batchId}`);
      setDeltas({});
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
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Reason</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReasonValue)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-700">Note (applied to every row)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Print run received 2026-07-05"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter title, SKU, handle, group…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm min-w-[240px]"
        />
        <select
          value={seriesFilter}
          onChange={(e) => setSeriesFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All series</option>
          <option value="nachman">R&apos; Nachman</option>
          <option value="nossen">R&apos; Nossen</option>
          <option value="anash">Anash</option>
          <option value="set">Sets</option>
          <option value="other">Other</option>
        </select>
        <span className="text-xs text-gray-500">
          {filtered.length} rows · {nonZero.length} pending
        </span>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Product / Variant</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">On hand</th>
              <th className="px-3 py-2 text-right">Reserved</th>
              <th className="px-3 py-2 text-right">Reorder at</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="px-3 py-2 text-right">New</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => {
              const delta = Number(deltas[r.variantId]) || 0;
              const newOnHand = r.onHand + delta;
              const isLow =
                r.reorderPoint != null && (newOnHand - r.reserved) <= r.reorderPoint;
              const wouldGoBelowZero = newOnHand < 0;
              return (
                <tr key={r.variantId} className={delta ? "bg-yellow-50/60" : ""}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.productTitle}</div>
                    <div className="text-xs text-gray-500">{r.variantName}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 text-right">{r.onHand}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">{r.reserved || "—"}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">
                    {r.reorderPoint ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={deltas[r.variantId] ?? ""}
                      onChange={(e) => setDeltas((d) => ({ ...d, [r.variantId]: e.target.value }))}
                      className={
                        "w-20 rounded border px-2 py-1 text-right text-sm " +
                        (wouldGoBelowZero
                          ? "border-red-300 bg-red-50"
                          : delta > 0
                            ? "border-green-300 bg-green-50"
                            : delta < 0
                              ? "border-yellow-300 bg-yellow-50"
                              : "border-gray-300")
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className={
                    "px-3 py-2 text-right " +
                    (wouldGoBelowZero
                      ? "text-red-600 font-semibold"
                      : isLow
                        ? "text-yellow-700"
                        : "")
                  }>
                    {delta ? newOnHand : ""}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No variants match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

      <div className="flex items-center gap-3 sticky bottom-4 rounded border border-gray-300 bg-white p-3 shadow">
        <button
          type="submit"
          disabled={busy || nonZero.length === 0}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Applying…" : `Apply ${nonZero.length} change${nonZero.length === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => setDeltas({})}
          disabled={nonZero.length === 0 || busy}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
