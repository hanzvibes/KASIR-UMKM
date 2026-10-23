"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Printer } from "lucide-react";
import { formatIDR } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/pos";

type CompletedSale = {
  id: string;
  invoice_no: string | null;
  payment_method: string;
  total_amount: number | string;
  cash_received: number | string | null;
  change_due: number | string | null;
};

export default function SaleComplete({ sale, businessId }: { sale: CompletedSale; businessId: string }) {
  const newSaleRef = useRef<HTMLAnchorElement>(null);
  const isCash = sale.payment_method === "cash";

  useEffect(() => {
    // The sale is stored on the server, so the local draft must not come back
    // on the next order. The marker keeps a later draft from being cleared.
    try {
      const draftKey = `kasir-umkm:checkout-draft-v1:${businessId}`;
      const markerKey = `kasir-umkm:checkout-cleared-sale-v1:${businessId}`;
      if (sessionStorage.getItem(markerKey) === sale.id) return;
      sessionStorage.removeItem(draftKey);
      sessionStorage.removeItem("kasir-umkm:checkout-draft-v1");
      sessionStorage.setItem(markerKey, sale.id);
    } catch {
      // Storage can be blocked; the transaction itself is already persisted.
    }
  }, [businessId, sale.id]);

  useEffect(() => {
    // Keep the next sale one Enter away after the cashier confirms payment.
    newSaleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby="sale-complete-title" className="mx-auto w-full max-w-lg animate-rise-in">
      <div className="rounded-3xl border border-green-200 bg-white p-6 text-center shadow-soft sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-50 text-green-700">
          <CheckCircle2 size={30} aria-hidden="true" />
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand">Pembayaran diterima</p>
        <h2 id="sale-complete-title" className="mt-1 text-2xl font-bold tracking-tight">Transaksi berhasil</h2>
        <p className="mt-1 text-sm text-muted">{sale.invoice_no ? `Struk ${sale.invoice_no}` : "Struk tersimpan"}</p>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Total dibayar</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-brand">{formatIDR(Number(sale.total_amount))}</p>

        <dl className="mt-6 divide-y divide-line rounded-2xl bg-canvas px-4 text-left text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted">Metode</dt>
            <dd className="font-semibold">{paymentMethodLabel(sale.payment_method)}</dd>
          </div>
          {isCash && (
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Uang diterima</dt>
              <dd className="tabular-nums font-medium">{formatIDR(Number(sale.cash_received ?? 0))}</dd>
            </div>
          )}
          {isCash && (
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="font-semibold">Kembalian</dt>
              <dd className="text-xl font-extrabold tabular-nums text-brand">{formatIDR(Number(sale.change_due ?? 0))}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          ref={newSaleRef}
          href="/checkout"
          className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 font-bold text-white transition hover:bg-[#196640]"
        >
          <Plus size={18} aria-hidden="true" /> Transaksi baru
        </Link>
        <Link
          href={`/sales/${sale.id}`}
          className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold hover:bg-canvas"
        >
          <Printer size={17} aria-hidden="true" /> Cetak struk
        </Link>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-muted">
        Transaksi tersimpan di riwayat. Pindai produk berikutnya setelah memulai transaksi baru.
      </p>
    </section>
  );
}
