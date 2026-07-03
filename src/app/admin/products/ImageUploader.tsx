"use client";

import { useRef, useState } from "react";

type Props = {
  onUploaded: (url: string) => void;
  compact?: boolean;
};

export default function ImageUploader({ onUploaded, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `upload failed (${res.status})`);
        return;
      }
      const body = await res.json();
      onUploaded(body.url);
    } catch {
      setErr("network error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "" : "flex items-center gap-2"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={compact ? "text-xs" : "text-sm"}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {busy && <span className="text-xs text-gray-500">uploading…</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
