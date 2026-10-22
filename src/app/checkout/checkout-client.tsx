"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { checkoutAction } from "./actions";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  unit: string;
  price: number;
  stock_qty: number | null;
  track_stock: boolean;
};

type CartLine = { productId: string; quantity: number };
type Category = { id: string; name: string };

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);

export default function CheckoutClient({
  products,
  categories,
  idempotencyKey,
  errorMessage,
}: {
  products: Product[];
  categories: Category[];
  idempotencyKey: string;
  errorMessage?: string;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLocaleLowerCase("id-ID").includes(query) || (product.sku ?? "").toLocaleLowerCase("id-ID").includes(query);
      return matchesSearch && (categoryId === "all" || product.category_id === categoryId);
    });
  }, [products, search, categoryId]);
  const subtotal = cart.reduce((sum, line) => {
    const product = productById.get(line.productId);
    return sum + Math.round(Number(product?.price ?? 0) * line.quantity);
  }, 0);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        const nextQuantity = existing.quantity + 1;
        if (product.track_stock && product.stock_qty !== null && nextQuantity > product.stock_qty) return current;
        return current.map((line) => line.productId === product.id ? { ...line, quantity: nextQuantity } : line);
      }
      if (product.track_stock && (product.stock_qty ?? 0) < 1) return current;
      return [...current, { productId: product.id, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    const product = productById.get(productId);
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.productId !== productId));
      return;
    }
    if (product?.track_stock && product.stock_qty !== null && quantity > product.stock_qty) return;
    setCart((current) => current.map((line) => line.productId === productId ? { ...line, quantity } : line));
  }

  const serializedItems = JSON.stringify(cart.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
  })));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Pilih produk</h2><p className="mt-1 text-sm text-muted">{filteredProducts.length} dari {products.length} produk aktif</p></div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ShoppingCart size={19} /></span>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="grid gap-1.5 text-xs font-semibold">Cari produk
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama produk atau SKU" className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal outline-none focus:border-brand" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">Kategori
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal">
              <option value="all">Semua kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        {products.length === 0 ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Belum ada produk aktif. Tambahkan produk terlebih dahulu.</p> : filteredProducts.length === 0 ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Produk tidak ditemukan. Coba kata kunci atau kategori lain.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((product) => {
              const outOfStock = product.track_stock && (product.stock_qty ?? 0) < 1;
              return <button key={product.id} type="button" disabled={outOfStock} onClick={() => addProduct(product)}
                className="flex min-h-32 flex-col rounded-xl border border-line p-3 text-left transition hover:border-brand hover:bg-brand-soft/30 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="line-clamp-2 text-sm font-semibold">{product.name}</span>
                <span className="mt-1 text-xs text-muted">{product.sku || product.unit}</span>
                <span className="mt-auto pt-4 text-sm font-bold text-brand">{rupiah(Number(product.price))}</span>
                {product.track_stock && <span className="mt-1 text-xs text-muted">Stok: {product.stock_qty ?? 0}</span>}
              </button>;
            })}
          </div>
        )}
      </section>

      <section className="h-fit rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Keranjang</h2><p className="mt-1 text-sm text-muted">{cart.length} jenis produk</p></div><ShoppingCart size={19} className="text-muted" /></div>
        {errorMessage && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
        {cart.length === 0 ? <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center"><ShoppingCart size={25} className="mx-auto text-muted" /><p className="mt-3 text-sm font-medium">Keranjang masih kosong</p><p className="mt-1 text-xs text-muted">Pilih produk untuk mulai transaksi.</p></div> : (
          <ul className="divide-y divide-line">
            {cart.map((line) => {
              const product = productById.get(line.productId);
              if (!product) return null;
              return <li key={line.productId} className="flex gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="mt-1 text-xs text-muted">{rupiah(Number(product.price))} / {product.unit}</p><p className="mt-1 text-sm font-semibold">{rupiah(Math.round(Number(product.price) * line.quantity))}</p></div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => changeQuantity(product.id, line.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line"><Minus size={14} /></button>
                  <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                  <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => changeQuantity(product.id, line.quantity + 1)} disabled={product.track_stock && product.stock_qty !== null && line.quantity >= product.stock_qty} className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"><Plus size={14} /></button>
                  <button type="button" aria-label={`Hapus ${product.name}`} onClick={() => changeQuantity(product.id, 0)} className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-red-600"><Trash2 size={14} /></button>
                </div>
              </li>;
            })}
          </ul>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between"><span className="text-sm text-muted">Total</span><strong className="text-xl">{rupiah(subtotal)}</strong></div>
          <form action={checkoutAction} className="mt-4 space-y-4">
            <input type="hidden" name="items" value={serializedItems} />
            <input type="hidden" name="idempotency_key" value={idempotencyKey} />
            <label className="grid gap-1.5 text-sm font-medium">Metode pembayaran
              <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5">
                <option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="other">Lainnya</option>
              </select>
            </label>
            <button type="submit" disabled={cart.length === 0 || products.length === 0} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-[#196640] disabled:cursor-not-allowed disabled:opacity-50">Simpan transaksi</button>
            <p className="text-xs leading-5 text-muted">Total dan stok diverifikasi kembali oleh database saat transaksi disimpan.</p>
          </form>
        </div>
      </section>
    </div>
  );
}
