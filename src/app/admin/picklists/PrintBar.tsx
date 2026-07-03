"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Props = {
  dateLabel: string;
  scope: string;
  orderCount: number;
  skuCount: number;
  itemCount: number;
};

export default function PrintBar({ dateLabel, scope, orderCount, skuCount, itemCount }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [date, setDate] = useState(dateLabel);
  const [scopeSel, setScopeSel] = useState(scope);

  function apply() {
    const q = new URLSearchParams(sp?.toString() || "");
    q.set("date", date);
    q.set("scope", scopeSel);
    router.push("/admin/picklists?" + q.toString());
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Batch picklist</h1>
        <p className="text-sm text-gray-500">
          {orderCount} orders · {skuCount} SKUs · {itemCount} items
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Scope</span>
          <select value={scopeSel} onChange={(e) => setScopeSel(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="unshipped">All unshipped paid (through end of day)</option>
            <option value="day">Just orders placed this day</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <button onClick={apply} className="rounded bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300">
          Apply
        </button>
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-1.5 text-sm text-white">
          Print
        </button>
      </div>
    </div>
  );
}
