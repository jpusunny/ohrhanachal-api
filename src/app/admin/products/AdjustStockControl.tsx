"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Movement = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  actor: string;
  createdAt: string;
};

const REASONS = ["initial", "manual_adjustment", "order", "return", "correction"] as const;

export default function AdjustStockControl({
  variantId,
  variantName,
  onHand,
}: {
  variantId: string;
  variantName: string;
  onHand: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("manual_adjustment");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch(`/api/admin/variants/${variantId}/movements`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setMovements(body.movements || []);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, variantId]);

  async function submit() {
    const parsed = Number(delta);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setErr("Delta must be a non-zero integer.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/variants/${variantId}/adjust-stock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta: Math.round(parsed), reason, note: note.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error === "would_go_negative" ? `Cannot go below 0 (current ${body.currentOnHand}).` : body.error || "Failed.");
        return;
      }
      setDelta("0");
      setNote("");
      const refreshed = await fetch(`/api/admin/variants/${variantId}/movements`).then((r) => r.json());
      setMovements(refreshed.movements || []);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
      >
        Adjust stock
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Adjust stock — {variantName}</h3>
            <p className="mt-1 text-xs text-gray-500">Current on hand: {onHand}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-gray-700">Delta (e.g. +5, -2)</span>
                <input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block text-gray-700">Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
                  className="w-full rounded border border-gray-300 px-2 py-1"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-3">
                <span className="mb-1 block text-gray-700">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
            </div>

            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded bg-black px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Applying…" : "Apply"}
              </button>
            </div>

            <div className="mt-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Recent history
              </h4>
              {movements === null && <p className="text-sm text-gray-500">Loading…</p>}
              {movements && movements.length === 0 && (
                <p className="text-sm text-gray-500">No movements yet.</p>
              )}
              {movements && movements.length > 0 && (
                <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                  {movements.map((m) => (
                    <li key={m.id} className="flex items-baseline gap-3 border-b border-gray-100 py-1">
                      <span
                        className={
                          m.delta > 0 ? "font-mono text-green-700" : "font-mono text-red-700"
                        }
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                      <span className="text-gray-700">{m.reason}</span>
                      {m.note && <span className="text-gray-500">— {m.note}</span>}
                      <span className="ml-auto text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleString()} · {m.actor}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
