"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { orderId: string; orderNo: string; status: string };

type Modal = null | "paid" | "shipped" | "cancel" | "note";

export default function OrderActions({ orderId, orderNo, status }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recordedAs, setRecordedAs] = useState("");
  const [carrier, setCarrier] = useState("USPS");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [noteInternal, setNoteInternal] = useState(true);

  async function transition(body: unknown, kind: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const body2 = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body2.details || body2.error || `${kind} failed`); return; }
      setModal(null);
      setRecordedAs(""); setTracking(""); setNote("");
      router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  async function addNote() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: note, internal: noteInternal }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error || "Note failed"); return; }
      setModal(null); setNote(""); router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  const canPay = status === "pending";
  const canShip = status === "paid";
  const canDeliver = status === "shipped";
  const canCancel = status === "pending" || status === "paid";

  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h2>
      <div className="flex flex-wrap gap-2">
        <button disabled={!canPay || busy} onClick={() => setModal("paid")}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">
          Mark paid
        </button>
        <button disabled={!canShip || busy} onClick={() => setModal("shipped")}
          className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-40">
          Mark shipped
        </button>
        <button disabled={!canDeliver || busy} onClick={() => transition({ action: "mark_delivered" }, "deliver")}
          className="rounded border border-green-500 px-3 py-2 text-sm text-green-700 disabled:opacity-40">
          Mark delivered
        </button>
        <button disabled={!canCancel || busy} onClick={() => setModal("cancel")}
          className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-40">
          Cancel
        </button>
        <button onClick={() => setModal("note")}
          className="ml-auto rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          + Add note
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {modal === "paid" && (
        <Modal title={`Mark ${orderNo} paid`} onClose={() => setModal(null)}>
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Recorded as (how was payment received?)</span>
            <input type="text" value={recordedAs} onChange={(e) => setRecordedAs(e.target.value)}
              placeholder="e.g. Check #4821 · Zelle from Chaim · Sola phone-card"
              className="w-full rounded border border-gray-300 px-3 py-2" autoFocus />
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-gray-700">Internal note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="rounded border border-gray-300 px-3 py-2 text-sm">Cancel</button>
            <button disabled={busy || !recordedAs.trim()} onClick={() => transition({ action: "mark_paid", recordedAs: recordedAs.trim(), note: note.trim() || undefined }, "pay")}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">
              {busy ? "Saving…" : "Mark paid & email customer"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "shipped" && (
        <Modal title={`Mark ${orderNo} shipped`} onClose={() => setModal(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Carrier</span>
              <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Tracking number</span>
              <input type="text" value={tracking} onChange={(e) => setTracking(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono" autoFocus />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This deducts stock from on-hand and clears the reservation for every line.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="rounded border border-gray-300 px-3 py-2 text-sm">Cancel</button>
            <button disabled={busy || !tracking.trim() || !carrier.trim()}
              onClick={() => transition({ action: "mark_shipped", carrier: carrier.trim(), trackingNumber: tracking.trim() }, "ship")}
              className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-40">
              {busy ? "Saving…" : "Mark shipped & email customer"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "cancel" && (
        <Modal title={`Cancel ${orderNo}`} onClose={() => setModal(null)}>
          <p className="text-sm text-gray-700">
            This releases the stock reservation. Any &ldquo;paid&rdquo; state is preserved on the record; you handle the refund out-of-band.
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-gray-700">Reason (optional, shared with customer)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="rounded border border-gray-300 px-3 py-2 text-sm">Keep it</button>
            <button disabled={busy}
              onClick={() => transition({ action: "cancel", note: note.trim() || undefined }, "cancel")}
              className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-40">
              {busy ? "Saving…" : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "note" && (
        <Modal title={`Add note to ${orderNo}`} onClose={() => setModal(null)}>
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              rows={4} className="w-full rounded border border-gray-300 px-3 py-2" autoFocus />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noteInternal} onChange={(e) => setNoteInternal(e.target.checked)} />
            Internal (hidden from customer lookup)
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="rounded border border-gray-300 px-3 py-2 text-sm">Cancel</button>
            <button disabled={busy || !note.trim()} onClick={addNote}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40">
              {busy ? "Saving…" : "Add note"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </>
  );
}
