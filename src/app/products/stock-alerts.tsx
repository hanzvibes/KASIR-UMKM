import { PackagePlus, TriangleAlert } from "lucide-react";
import { LOW_STOCK_THRESHOLD, stockState } from "@/lib/pos";
import { restockProduct } from "./actions";

type AlertProduct = {
  id: string;
  name: string;
  unit: string;
  stock_qty: number | string | null;
  track_stock: boolean;
};

export default function StockAlerts({
  products,
  total,
  canManage,
  error,
}: {
  products: AlertProduct[];
  total: number;
  canManage: boolean;
  error: boolean;
}) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Peringatan stok gagal dimuat. Muat ulang halaman agar produk yang perlu diisi ulang tidak terlewat.
      </p>
    );
  }
  if (total === 0) return null;

  return (
    <section aria-labelledby="stock-alert-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="stock-alert-title" className="font-semibold text-amber-950">Stok perlu perhatian</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            {total} produk aktif punya stok {LOW_STOCK_THRESHOLD} atau kurang. Isi ulang sebelum melayani pembeli
            berikutnya agar transaksi tidak terhenti.
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-amber-200/80">
        {products.map((product) => {
          const state = stockState(product);
          const stock = Number(product.stock_qty ?? 0);
          return (
            <li key={product.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-950">{product.name}</p>
                  <p className="mt-1 text-xs text-amber-900">
                    {state === "out" ? "Stok habis" : `Sisa ${stock} ${product.unit}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state === "out" ? "bg-red-100 text-red-800" : "bg-amber-200 text-amber-950"}`}>
                  {state === "out" ? "Habis" : "Menipis"}
                </span>
              </div>
              {canManage && (
                <form action={restockProduct} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="id" value={product.id} />
                  <label className="sr-only" htmlFor={`restock-${product.id}`}>Jumlah stok masuk untuk {product.name}</label>
                  <input
                    id={`restock-${product.id}`}
                    name="quantity"
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    required
                    placeholder={`Tambah (${product.unit})`}
                    className="min-h-10 w-36 rounded-lg border border-amber-300 bg-white px-3 text-sm"
                  />
                  <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-950">
                    <PackagePlus size={14} aria-hidden="true" /> Tambah stok
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {total > products.length && (
        <p className="mt-3 text-xs leading-5 text-amber-900">
          Menampilkan {products.length} dari {total} produk. Periksa daftar produk di bawah untuk sisanya.
        </p>
      )}
    </section>
  );
}
