"use client";

import { useRef } from "react";
import { Banknote, X } from "lucide-react";
import { addCashMovementAction } from "@/app/shifts/actions";

export default function CashMovementDialog({ shiftId }: { shiftId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-canvas"
      >
        <Banknote size={17} /> Catat kas
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="cash-movement-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 id="cash-movement-title" className="font-bold">Catat kas</h2>
          </div>
          <button
            type="button"
            aria-label="Tutup dialog"
            onClick={() => dialogRef.current?.close()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted hover:bg-canvas"
          >
            <X size={18} />
          </button>
        </div>
        <form action={addCashMovementAction} className="space-y-4 p-5">
          <input type="hidden" name="shift_id" value={shiftId} />
          <label className="grid gap-1.5 text-sm font-medium">
            Tindakan
            <select name="movement_type" className="min-h-11 rounded-xl border border-line px-3 font-normal">
              <option value="cash_in">Tambah uang ke laci</option>
              <option value="cash_out">Ambil uang dari laci</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Nominal (Rp)
            <input name="amount" required type="number" min="1" step="1" className="min-h-11 rounded-xl border border-line px-3 font-normal" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Alasan
            <input name="reason" required maxLength={240} placeholder="Contoh: tambah uang kembalian" className="min-h-11 rounded-xl border border-line px-3 font-normal" />
          </label>
          <button className="min-h-12 w-full rounded-xl bg-brand px-4 font-semibold text-white hover:bg-[#196640]">
            Simpan
          </button>
        </form>
      </dialog>
    </>
  );
}
