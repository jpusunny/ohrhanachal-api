"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdjustStockControl from "./AdjustStockControl";
import ImageUploader from "./ImageUploader";

type VariantState = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  priceCents: string;
  compareAtCents: string;
  weightGrams: string;
  active: boolean;
  onHand: number;
  initialOnHand: string;
};

type ImageState = {
  id?: string;
  url: string;
  altText: string;
  position: string;
};

export type ProductFormInitial = {
  id?: string;
  title: string;
  titleHe: string;
  author: string;
  series: string;
  descriptionHtml: string;
  status: "draft" | "active";
  voiceCode: string;
  variants: VariantState[];
  images: ImageState[];
};

export const emptyInitial: ProductFormInitial = {
  title: "",
  titleHe: "",
  author: "",
  series: "",
  descriptionHtml: "",
  status: "draft",
  voiceCode: "",
  variants: [],
  images: [],
};

function newVariant(): VariantState {
  return {
    name: "Regular",
    sku: "",
    barcode: "",
    priceCents: "0",
    compareAtCents: "",
    weightGrams: "",
    active: true,
    onHand: 0,
    initialOnHand: "0",
  };
}

function newImage(position: number): ImageState {
  return { url: "", altText: "", position: String(position) };
}

function toIntOrNull(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export default function ProductForm({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  const [state, setState] = useState<ProductFormInitial>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setField<K extends keyof ProductFormInitial>(key: K, value: ProductFormInitial[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function updateVariant(idx: number, patch: Partial<VariantState>) {
    setState((s) => {
      const variants = s.variants.slice();
      variants[idx] = { ...variants[idx], ...patch };
      return { ...s, variants };
    });
  }

  function updateImage(idx: number, patch: Partial<ImageState>) {
    setState((s) => {
      const images = s.images.slice();
      images[idx] = { ...images[idx], ...patch };
      return { ...s, images };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const payload = {
      title: state.title.trim(),
      titleHe: state.titleHe.trim() || null,
      author: state.author.trim() || null,
      series: state.series.trim() || null,
      descriptionHtml: state.descriptionHtml.trim() || null,
      status: state.status,
      voiceCode: state.voiceCode.trim() || null,
      variants: state.variants.map((v) => ({
        id: v.id,
        name: v.name.trim(),
        sku: v.sku.trim(),
        barcode: v.barcode.trim() || null,
        priceCents: toIntOrNull(v.priceCents) ?? 0,
        compareAtCents: toIntOrNull(v.compareAtCents),
        weightGrams: toIntOrNull(v.weightGrams),
        active: v.active,
        ...(v.id ? {} : { initialOnHand: Math.max(0, toIntOrNull(v.initialOnHand) ?? 0) }),
      })),
      images: state.images.map((img, idx) => ({
        id: img.id,
        url: img.url.trim(),
        altText: img.altText.trim() || null,
        position: toIntOrNull(img.position) ?? idx,
      })).filter((img) => img.url.length > 0),
    };

    try {
      const url = isEdit ? `/api/admin/products/${initial.id}` : "/api/admin/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error === "unique_constraint" ? "A SKU or voice code you entered is already in use." : body.error || "Save failed.");
        return;
      }
      const body = await res.json();
      if (!isEdit && body.product?.id) {
        router.push(`/admin/products/${body.product.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !initial.id) return;
    if (!confirm(`Delete "${state.title}"? This removes all variants, images, inventory, and stock history.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        setErr("Delete failed.");
        return;
      }
      router.push("/admin/products");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="rounded border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title" required>
            <input
              type="text"
              required
              value={state.title}
              onChange={(e) => setField("title", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </Field>
          <Field label="Hebrew title">
            <input
              type="text"
              dir="rtl"
              value={state.titleHe}
              onChange={(e) => setField("titleHe", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-right"
            />
          </Field>
          <Field label="Author">
            <input
              type="text"
              value={state.author}
              onChange={(e) => setField("author", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </Field>
          <Field label="Series">
            <input
              type="text"
              value={state.series}
              onChange={(e) => setField("series", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </Field>
          <Field label="Status">
            <select
              value={state.status}
              onChange={(e) => setField("status", e.target.value as "draft" | "active")}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
            </select>
          </Field>
          <Field label="Voice code (unique)">
            <input
              type="text"
              inputMode="numeric"
              value={state.voiceCode}
              onChange={(e) => setField("voiceCode", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="e.g. 1042"
            />
          </Field>
        </div>
        <Field label="Description (HTML)">
          <textarea
            value={state.descriptionHtml}
            onChange={(e) => setField("descriptionHtml", e.target.value)}
            rows={6}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </Field>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Variants</h2>
          <button
            type="button"
            onClick={() => setField("variants", [...state.variants, newVariant()])}
            className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
          >
            + Add variant
          </button>
        </div>
        {state.variants.length === 0 && (
          <p className="text-sm text-gray-500">
            Add at least one variant (format), e.g. Regular / Pocket / Pocket Leather.
          </p>
        )}
        <div className="space-y-3">
          {state.variants.map((v, idx) => (
            <div key={v.id ?? `new-${idx}`} className="rounded border border-gray-200 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-gray-600">Name</label>
                  <input
                    value={v.name}
                    onChange={(e) => updateVariant(idx, { name: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Regular / Pocket / Pocket Leather"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">SKU</label>
                  <input
                    value={v.sku}
                    onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Price (¢)</label>
                  <input
                    type="number"
                    min={0}
                    value={v.priceCents}
                    onChange={(e) => updateVariant(idx, { priceCents: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Compare-at (¢)</label>
                  <input
                    type="number"
                    min={0}
                    value={v.compareAtCents}
                    onChange={(e) => updateVariant(idx, { compareAtCents: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Weight (g)</label>
                  <input
                    type="number"
                    min={0}
                    value={v.weightGrams}
                    onChange={(e) => updateVariant(idx, { weightGrams: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-gray-600">Barcode</label>
                  <input
                    value={v.barcode}
                    onChange={(e) => updateVariant(idx, { barcode: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">
                    {v.id ? "On hand" : "Initial on hand"}
                  </label>
                  {v.id ? (
                    <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700">
                      {v.onHand}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={v.initialOnHand}
                      onChange={(e) => updateVariant(idx, { initialOnHand: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Active</label>
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) => updateVariant(idx, { active: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-end justify-end gap-2">
                  {v.id && (
                    <AdjustStockControl variantId={v.id} variantName={v.name} onHand={v.onHand} />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setField(
                        "variants",
                        state.variants.filter((_, i) => i !== idx),
                      )
                    }
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Images</h2>
          <div className="flex items-center gap-3">
            <ImageUploader
              onUploaded={(url) => {
                setState((s) => ({
                  ...s,
                  images: [
                    ...s.images,
                    { url, altText: "", position: String(s.images.length) },
                  ],
                }));
              }}
            />
            <button
              type="button"
              onClick={() => setField("images", [...state.images, newImage(state.images.length)])}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
            >
              + Paste URL
            </button>
          </div>
        </div>
        {state.images.length === 0 && (
          <p className="text-sm text-gray-500">
            No images yet. Upload one above, or paste a URL.
          </p>
        )}
        <div className="space-y-2">
          {state.images.map((img, idx) => (
            <div
              key={img.id ?? `new-${idx}`}
              className="flex items-start gap-2 rounded border border-gray-200 p-2"
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={img.altText || ""}
                  className="h-16 w-16 flex-shrink-0 rounded border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400">
                  no image
                </div>
              )}
              <div className="grid flex-1 grid-cols-12 gap-2">
                <input
                  value={img.url}
                  onChange={(e) => updateImage(idx, { url: e.target.value })}
                  placeholder="https://…"
                  className="col-span-7 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  value={img.altText}
                  onChange={(e) => updateImage(idx, { altText: e.target.value })}
                  placeholder="alt text"
                  className="col-span-3 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={img.position}
                  onChange={(e) => updateImage(idx, { position: e.target.value })}
                  placeholder="pos"
                  className="col-span-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      "images",
                      state.images.filter((_, i) => i !== idx),
                    )
                  }
                  className="col-span-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
                <div className="col-span-12">
                  <ImageUploader
                    compact
                    onUploaded={(url) => updateImage(idx, { url })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
