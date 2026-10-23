"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { paymentMethodLabel } from "@/lib/pos";

type Sale = {
  id: string;
  invoice_no: string | null;
  payment_method: string;
  total_amount: number;
  created_at: string;
  status: string;
};

const money = (value: number | string) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));

export default function SalesFilters({ sales }: { sales: Sale[] }) {
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const visibleSales = useMemo(() => sales.filter((sale) => (status === "all" || sale.status === status) && (payment === "all" || sale.payment_method === payment)), [sales, status, payment]);

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-3 sm:flex sm:items-center">
        <label className="grid gap-1 text-xs font-semibold text-muted">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink">
            <option value="all">Semua status</option><option value="completed">Tersimpan</option><option value="voided">Dibatalkan</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Pembayaran
          <select value={payment} onChange={(event) => setPayment(event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink">
            <option value="all">Semua metode</option><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option>
          </select>
        </label>
        <p className="col-span-2 text-xs text-muted sm:ml-auto">{visibleSales.length} transaksi ditampilkan di halaman ini</p>
      </div>
      {visibleSales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Tidak ada transaksi yang cocok dengan filter ini.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {visibleSales.map((sale) => <Link key={sale.id} href={`/sales/${sale.id}`} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0 hover:bg-canvas sm:px-5">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${sale.status === "voided" ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand"}`}><span aria-hidden="true" className="text-sm font-bold">{sale.status === "voided" ? "×" : "✓"}</span></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{sale.invoice_no ?? `Struk #${sale.id.slice(0, 8).toUpperCase()}`}</span><span className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(sale.created_at))} · {paymentMethodLabel(sale.payment_method)}</span></span>
            <span className="text-right"><span className="block text-sm font-bold tabular-nums">{money(sale.total_amount)}</span><span className={`mt-1 block text-xs font-medium ${sale.status === "voided" ? "text-red-700" : "text-green-700"}`}>{sale.status === "voided" ? "Dibatalkan" : "Tersimpan"}</span></span>
          </Link>)}
        </div>
      )}
    </>
  );
}
