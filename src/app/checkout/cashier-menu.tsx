import { MoreVertical } from "lucide-react";
import { closeShiftAction } from "@/app/shifts/actions";
import ActivityPanel from "./activity-panel";
import CashMovementDialog from "./cash-movement-dialog";

type CashMovement = {
  movement_type: string;
  amount: number | string;
  reason: string;
  created_at: string;
};

const money = (value: number | string) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(Number(value));

export default function CashierMenu({
  shiftId,
  openingCash,
  expectedCash,
  cashIn,
  cashOut,
  movements,
}: {
  shiftId: string;
  openingCash: number;
  expectedCash: number;
  cashIn: number;
  cashOut: number;
  movements: CashMovement[];
}) {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label="Menu kasir"
        title="Menu kasir"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-line bg-white text-ink hover:bg-canvas [&::-webkit-details-marker]:hidden"
      >
        <MoreVertical size={20} />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(75dvh,34rem)] w-72 max-w-[calc(100vw-2rem)] space-y-1 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-xl">
        <div className="rounded-xl bg-brand-soft px-3 py-2.5">
          <span className="block text-xs text-muted">Uang laci</span>
          <strong className="tabular-nums">{money(expectedCash)}</strong>
        </div>

        <ActivityPanel />
        <CashMovementDialog shiftId={shiftId} />

        <details className="rounded-xl">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold hover:bg-canvas">Rincian shift</summary>
          <dl className="space-y-2 px-3 pb-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Modal awal</dt><dd className="font-semibold">{money(openingCash)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Kas masuk</dt><dd className="font-semibold">{money(cashIn)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Kas keluar</dt><dd className="font-semibold">{money(cashOut)}</dd></div>
          </dl>
        </details>

        {movements.length > 0 && (
          <details className="rounded-xl">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold hover:bg-canvas">Riwayat kas</summary>
            <div className="divide-y divide-line px-3 pb-2">
              {movements.map((movement, index) => (
                <div key={`${movement.created_at}-${index}`} className="py-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{movement.movement_type === "cash_in" ? "Kas masuk" : "Kas keluar"}</span>
                    <strong>{money(movement.amount)}</strong>
                  </div>
                  <p className="mt-0.5 text-muted">{movement.reason}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        <details className="rounded-xl">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">Tutup shift</summary>
          <form action={closeShiftAction} className="space-y-3 px-3 pb-3">
            <input type="hidden" name="shift_id" value={shiftId} />
            <label className="grid gap-1 text-xs font-medium">
              Uang aktual (Rp)
              <input name="actual_cash" required type="number" min="0" step="1" className="min-h-11 rounded-lg border border-line px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Catatan
              <input name="note" maxLength={500} className="min-h-11 rounded-lg border border-line px-3 text-sm" />
            </label>
            <button className="min-h-11 w-full rounded-lg bg-amber-900 px-3 text-sm font-semibold text-white">Tutup shift</button>
          </form>
        </details>
      </div>
    </details>
  );
}
