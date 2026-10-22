"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProductVariants } from "./actions";

type VariantOption = { name: string; price_delta: number };
type VariantGroup = { name: string; required: boolean; options: VariantOption[] } | null;

export default function VariantEditor({ productId, basePrice, initial }: { productId: string; basePrice: number; initial: VariantGroup }) {
  const [groupName, setGroupName] = useState(initial?.name ?? "Ukuran");
  const [required, setRequired] = useState(initial?.required ?? true);
  const [options, setOptions] = useState<VariantOption[]>(initial?.options ?? []);

  function updateOption(index: number, key: keyof VariantOption, value: string) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index
      ? { ...option, [key]: key === "price_delta" ? (value === "" ? 0 : Number(value)) : value }
      : option));
  }

  return (
    <form action={saveProductVariants} className="mt-4 space-y-3 rounded-xl border border-line bg-white p-3 sm:p-4">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="required" value={String(required)} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-40 flex-1 gap-1 text-xs font-semibold">Nama pilihan, misalnya ukuran atau rasa
          <input name="group_name" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} className="rounded-lg border border-line px-3 py-2 text-sm font-normal" />
        </label>
        <label className="flex min-h-10 items-center gap-2 text-xs font-medium"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="accent-brand" /> Kasir wajib memilih</label>
      </div>
      {options.length === 0 ? <p className="text-xs leading-5 text-muted">Belum ada pilihan. Tambahkan satu atau lebih; simpan tanpa pilihan untuk menghapus varian.</p> : <div className="space-y-2">
        {options.map((option, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(100px,0.55fr)_40px] items-end gap-2">
          <label className="grid gap-1 text-xs font-medium">Nama opsi
            <input value={option.name} onChange={(event) => updateOption(index, "name", event.target.value)} maxLength={80} placeholder="Contoh: Besar" className="min-w-0 rounded-lg border border-line px-3 py-2 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-xs font-medium">Tambah harga (Rp)
            <input type="number" min={-basePrice} step="1" value={option.price_delta} onChange={(event) => updateOption(index, "price_delta", event.target.value)} className="min-w-0 rounded-lg border border-line px-3 py-2 text-sm font-normal" />
          </label>
          <button type="button" aria-label={`Hapus pilihan ${option.name || index + 1}`} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))} className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-700"><Trash2 size={16} /></button>
        </div>)}
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={options.length >= 12} onClick={() => setOptions((current) => [...current, { name: "", price_delta: 0 }])} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold disabled:opacity-50"><Plus size={15} /> Tambah pilihan</button>
        <button className="min-h-10 rounded-lg bg-brand px-4 text-xs font-semibold text-white">Simpan varian</button>
      </div>
      <p className="text-[11px] leading-4 text-muted">Harga dasar produk tetap tersimpan. Selisih harga dapat bernilai positif atau negatif.</p>
    </form>
  );
}
