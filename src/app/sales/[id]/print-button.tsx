"use client";

import { Printer } from "lucide-react";

export default function PrintReceiptButton() {
  return <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold"><Printer size={16} /> Cetak struk</button>;
}
