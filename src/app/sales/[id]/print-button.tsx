"use client";

import { Bluetooth, Printer } from "lucide-react";

export default function PrintReceiptButton() {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-[#196640]">
        <Printer size={16} /> Cetak struk
      </button>
      <details className="relative print:hidden">
        <summary aria-label="Cara mencetak dengan printer Bluetooth" title="Cetak dengan Bluetooth" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brand hover:text-brand [&::-webkit-details-marker]:hidden">
          <Bluetooth size={18} />
        </summary>
        <div className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-4 text-left shadow-xl">
          <h2 className="text-sm font-bold">Cetak via Bluetooth</h2>
          <ol className="mt-2 list-inside list-decimal space-y-2 text-xs leading-5 text-muted">
            <li>Pasangkan printer thermal melalui pengaturan Bluetooth perangkat terlebih dahulu.</li>
            <li>Tekan <strong className="text-ink">Cetak struk</strong>, lalu pilih printer Bluetooth dari dialog cetak.</li>
            <li>Pilih ukuran kertas yang sesuai (58 mm atau 80 mm) pada pengaturan printer.</li>
          </ol>
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-4 text-muted">Dukungan pemilihan printer bergantung pada browser dan sistem operasi. Printer harus sudah terpasang di perangkat.</p>
        </div>
      </details>
    </div>
  );
}
