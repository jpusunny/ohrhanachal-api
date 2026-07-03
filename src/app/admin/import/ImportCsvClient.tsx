"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PlanRow = {
  handle: string;
  action: "create" | "skip" | "error";
  reason?: string;
  productSummary?: { title: string; sku: string; priceCents: number; qty: number; status: "draft" | "active"; imageCount: number };
};

type Plan = {
  rows: PlanRow[];
  productsToCreate: number;
  productsToSkip: number;
  errors: number;
  imageOps: { toAdd: number; alreadyPresent: number };
};

type Summary = {
  productsCreated: number;
  productsSkipped: number;
  imagesAdded: number;
  imagesSkipped: number;
  errors: string[];
};

export default function ImportCsvClient() {
  const router = useRouter();
  const [fileText, setFileText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFile(f: File) {
    setErr(null);
    setSummary(null);
    setPlan(null);
    setFileName(f.name);
    const text = await f.text();
    setFileText(text);
  }

  async function runDryRun() {
    if (!fileText) return;
    setErr(null);
    setBusy(true);
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", new Blob([fileText], { type: "text/csv" }), fileName || "catalog.csv");
      const res = await fetch("/api/admin/import-csv", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error || "Dry-run failed."); return; }
      setPlan(body.plan);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    if (!confirm(`Apply this import? ${plan.productsToCreate} products will be created, ${plan.imageOps.toAdd} images added.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", new Blob([fileText], { type: "text/csv" }), fileName || "catalog.csv");
      fd.append("apply", "1");
      const res = await fetch("/api/admin/import-csv", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error || "Apply failed."); return; }
      setSummary(body.summary);
      setPlan(null);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Shopify products_export.csv</span>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
            }}
            className="text-sm"
          />
        </label>
        {fileName && (
          <p className="mt-2 text-xs text-gray-500">Selected: {fileName} · {fileText.length.toLocaleString()} chars</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={runDryRun}
            disabled={!fileText || busy}
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy && !plan && !summary ? "Analyzing…" : "Run dry-run"}
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {plan && (
        <div className="space-y-3">
          <div className="rounded border border-gray-200 bg-white p-4 text-sm">
            <p>
              <strong>{plan.productsToCreate}</strong> product{plan.productsToCreate === 1 ? "" : "s"} to create,{" "}
              <strong>{plan.productsToSkip}</strong> already exist,{" "}
              <strong>{plan.errors}</strong> error{plan.errors === 1 ? "" : "s"}.
              Images: <strong>{plan.imageOps.toAdd}</strong> new, {plan.imageOps.alreadyPresent} already present.
            </p>
          </div>

          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Handle</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plan.rows.map((r) => (
                  <tr key={r.handle} className={r.action === "error" ? "bg-red-50/60" : r.action === "skip" ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 font-mono text-xs">{r.handle}</td>
                    <td className="px-3 py-2">
                      <span className={
                        "rounded px-2 py-0.5 text-xs font-medium " +
                        (r.action === "create" ? "bg-green-100 text-green-800"
                          : r.action === "skip" ? "bg-gray-200 text-gray-700"
                            : "bg-red-100 text-red-800")
                      }>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {r.action === "create" && r.productSummary && (
                        <>
                          {r.productSummary.title} · SKU {r.productSummary.sku} · ${(r.productSummary.priceCents/100).toFixed(2)}
                          {" · "}stock {r.productSummary.qty} · {r.productSummary.imageCount} image{r.productSummary.imageCount === 1 ? "" : "s"}
                        </>
                      )}
                      {r.reason && r.action !== "create" && <span>{r.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.productsToCreate > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={apply}
                disabled={busy}
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Applying…" : `Apply — create ${plan.productsToCreate} product${plan.productsToCreate === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={() => setPlan(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-semibold text-green-800">Import complete.</p>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>Products created: <strong>{summary.productsCreated}</strong></li>
            <li>Products skipped (SKU already existed): <strong>{summary.productsSkipped}</strong></li>
            <li>Images added: <strong>{summary.imagesAdded}</strong></li>
            <li>Images skipped (already on product): <strong>{summary.imagesSkipped}</strong></li>
            {summary.errors.length > 0 && (
              <li className="text-red-700">
                Errors: <strong>{summary.errors.length}</strong>
                <ul className="ml-4 list-disc text-xs">
                  {summary.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {summary.errors.length > 10 && <li>… and {summary.errors.length - 10} more.</li>}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
