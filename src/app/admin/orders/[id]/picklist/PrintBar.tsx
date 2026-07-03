"use client";

import Link from "next/link";

export default function PrintBar({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  return (
    <div className="no-print mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Picklist &amp; packing slip — <span className="font-mono">{orderNo}</span></h1>
        <p className="text-sm text-gray-500">Two pages: the picklist (staff) prints first, packing slip (customer) prints second.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-sm text-white">Print</button>
        <Link href={`/admin/orders/${orderId}`} className="rounded border border-gray-300 px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  );
}
