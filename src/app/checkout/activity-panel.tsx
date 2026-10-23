"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ReceiptText, X } from "lucide-react";

type Sale = { id: string; invoice_no: string | null; payment_method: string; total_amount: number; created_at: string; status: string };
type PageData = { sales: Sale[]; hasNextPage: boolean };
const paymentLabels: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function ActivityPanel() {
  const [open, setOpen] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", close); };
  }, [open]);

  async function loadPage(nextPage: number) {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/sales?page=${nextPage}`, { cache: "no-store" });
      if (!response.ok) throw new Error("History request failed");
      const data = await response.json() as PageData;
      setSales(data.sales);
      setPage(nextPage);
      setHasNextPage(data.hasNextPage);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function showPanel() {
    setOpen(true);
    if (sales.length === 0 && !loading) void loadPage(1);
  }

  return <>
    <button type="button" onClick={showPanel} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas" aria-label="Buka transaksi terakhir">
      <ReceiptText size={17} /><span>Transaksi</span>
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[70] flex justify-end bg-black/40 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="activity-title" className="flex h-full w-full max-w-lg flex-col bg-canvas shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1"><h2 id="activity-title" className="font-bold">Transaksi terakhir</h2></div>
          <button type="button" aria-label="Tutup transaksi" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && <p role="status" className="py-8 text-center text-sm text-muted">Memuat transaksi…</p>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Transaksi gagal dimuat. <button type="button" onClick={() => void loadPage(page)} className="font-bold underline">Coba lagi</button></div>}
          {!loading && !error && sales.length === 0 && <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"><ReceiptText size={26} className="mx-auto text-muted" /><p className="mt-3 font-semibold">Belum ada transaksi</p></div>}
          {!loading && !error && <div className="overflow-hidden rounded-2xl border border-line bg-white">{sales.map((sale) => <Link key={sale.id} href={`/sales/${sale.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-line p-4 last:border-0 hover:bg-canvas">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${sale.status === "voided" ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand"}`} aria-hidden="true">{sale.status === "voided" ? "×" : "✓"}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{sale.invoice_no ?? `Struk #${sale.id.slice(0, 8).toUpperCase()}`}</span><span className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(sale.created_at))} · {paymentLabels[sale.payment_method] ?? sale.payment_method}</span></span>
            <span className="text-right"><span className="block text-sm font-bold tabular-nums">{money(sale.total_amount)}</span><span className={`mt-1 block text-xs ${sale.status === "voided" ? "text-red-700" : "text-green-700"}`}>{sale.status === "voided" ? "Dibatalkan" : "Tersimpan"}</span></span>
          </Link>)}</div>}
          {!loading && !error && sales.length > 0 && <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3"><span className="text-sm text-muted">Halaman {page}</span><div className="flex gap-2">{page > 1 && <button type="button" onClick={() => void loadPage(page - 1)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Sebelumnya</button>}{hasNextPage && <button type="button" onClick={() => void loadPage(page + 1)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Berikutnya</button>}</div></div>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
