"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { id: string; status: string; internalNotes: string };

export default function WholesaleAccountActions({ id, status, internalNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(internalNotes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch(`/api/admin/wholesale/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Update failed."); return; }
      setMsg("Saved.");
      router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <button disabled={busy || status === "approved"}
          onClick={() => patch({ status: "approved" })}
          className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-40">
          Approve (enables wholesale pricing)
        </button>
        <button disabled={busy || status === "suspended"}
          onClick={() => patch({ status: "suspended" })}
          className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-40">
          Suspend
        </button>
        <button disabled={busy || status === "pending"}
          onClick={() => patch({ status: "pending" })}
          className="rounded border border-yellow-300 px-3 py-2 text-sm text-yellow-800 disabled:opacity-40">
          Move to pending
        </button>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">Internal notes</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Mosad reference, terms discussed, etc." />
      </label>
      <div className="mt-2 flex justify-end">
        <button disabled={busy || notes === internalNotes}
          onClick={() => patch({ internalNotes: notes })}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save notes"}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </section>
  );
}
