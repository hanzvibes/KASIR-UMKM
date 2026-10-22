"use client";

export default function PrintReportButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold print:hidden">Cetak laporan</button>;
}
