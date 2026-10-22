"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Minus, Plus, Search, ShoppingCart, Trash2, X, CheckCircle2 } from "lucide-react";
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
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState(idempotencyKey);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLocaleLowerCase("id-ID").includes(query)
        || (product.sku ?? "").toLocaleLowerCase("id-ID").includes(query);
      return matchesSearch && (categoryId === "all" || product.category_id === categoryId);
    });
  }, [products, search, categoryId]);

  const subtotal = cart.reduce((sum, line) => {
    const product = productById.get(line.productId);
    return sum + Math.round(Number(product?.price ?? 0) * line.quantity);
  }, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const quickCashAmounts = [...new Set([subtotal, 50_000, 100_000].filter((amount) => amount >= subtotal && amount > 0))];

  useEffect(() => {
    const draftKey = "kasir-umkm:checkout-draft-v1";
    if (!errorMessage) {
      sessionStorage.removeItem(draftKey);
      return;
    }
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { items?: unknown; idempotencyKey?: unknown };
      if (Array.isArray(draft.items)) {
        const restored = draft.items.filter((item): item is CartLine =>
          !!item && typeof item === "object" && "productId" in item && "quantity" in item
          && typeof item.productId === "string" && productById.has(item.productId)
          && typeof item.quantity === "number" && Number.isFinite(item.quantity)
          && item.quantity > 0 && item.quantity <= 1_000_000
        );
        setCart(restored);
        if (typeof draft.idempotencyKey === "string" && draft.idempotencyKey.length <= 100) {
          setActiveIdempotencyKey(draft.idempotencyKey);
        }
      }
    } catch {
      // Ignore a malformed local draft; server validation remains authoritative.
    } finally {
      sessionStorage.removeItem(draftKey);
    }
  }, [errorMessage, idempotencyKey, productById]);

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
    setCashReceived("");
  }

  function changeQuantity(productId: string, quantity: number) {
    const product = productById.get(productId);
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.productId !== productId));
      setCashReceived("");
      return;
    }
    if (product?.track_stock && product.stock_qty !== null && quantity > product.stock_qty) return;
    setCart((current) => current.map((line) => line.productId === productId ? { ...line, quantity } : line));
    setCashReceived("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitting || cart.length === 0) {
      event.preventDefault();
      return;
    }
    try {
      sessionStorage.setItem("kasir-umkm:checkout-draft-v1", JSON.stringify({
        items: cart,
        idempotencyKey: activeIdempotencyKey,
      }));
    } catch {
      // Checkout still proceeds if the browser blocks session storage.
    }
    setSubmitting(true);
  }

  const serializedItems = JSON.stringify(cart.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
  })));

  const cartContent = (
    <>
      {errorMessage && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
      {cart.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
          <ShoppingCart size={25} className="mx-auto text-muted" />
          <p className="mt-3 text-sm font-medium">Keranjang masih kosong</p>
          <p className="mt-1 text-xs leading-5 text-muted">Ketuk produk untuk langsung menambahkannya.</p>
        </div>
      ) : (
        <ul className="max-h-[34vh] divide-y divide-line overflow-y-auto overscroll-contain">
          {cart.map((line) => {
            const product = productById.get(line.productId);
            if (!product) return null;
            return (
              <li key={line.productId} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{rupiah(Number(product.price))} / {product.unit}</p>
                  <p className="mt-1 text-sm font-bold">{rupiah(Math.round(Number(product.price) * line.quantity))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => changeQuantity(product.id, line.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line active:bg-canvas"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                  <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => changeQuantity(product.id, line.quantity + 1)} disabled={product.track_stock && product.stock_qty !== null && line.quantity >= product.stock_qty} className="grid h-9 w-9 place-items-center rounded-lg border border-line active:bg-canvas disabled:opacity-40"><Plus size={14} /></button>
                  <button type="button" aria-label={`Hapus ${product.name}`} onClick={() => changeQuantity(product.id, 0)} className="grid h-9 w-8 place-items-center rounded-lg text-red-600 active:bg-red-50"><Trash2 size={15} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 border-t border-line pt-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-muted">Total tagihan</span>
          <strong className="text-2xl font-bold tracking-tight tabular-nums">{rupiah(subtotal)}</strong>
        </div>
        <form action={checkoutAction} onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input type="hidden" name="items" value={serializedItems} />
          <input type="hidden" name="idempotency_key" value={activeIdempotencyKey} />
          <div className="grid grid-cols-3 gap-2" aria-label="Metode pembayaran">
            {[
              { value: "cash", label: "Tunai" },
              { value: "transfer", label: "Transfer" },
              { value: "other", label: "Lainnya" },
            ].map((method) => (
              <button key={method.value} type="button" aria-pressed={paymentMethod === method.value}
                onClick={() => setPaymentMethod(method.value)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors ${paymentMethod === method.value ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-muted"}`}>
                {method.label}
              </button>
            ))}
            <input type="hidden" name="payment_method" value={paymentMethod} />
          </div>
          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <label className="grid gap-1.5 text-sm font-medium">Uang diterima
                <input name="cash_received" type="number" inputMode="numeric" min={subtotal} step="1" required
                  value={cashReceived} onChange={(event) => setCashReceived(event.target.value)}
                  placeholder={String(subtotal || 0)} className="w-full rounded-xl border border-line px-3 py-3 text-base font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
              </label>
              {subtotal > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => (
                    <button key={amount} type="button" onClick={() => setCashReceived(String(amount))}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted active:bg-canvas">
                      {amount === subtotal ? "Uang pas" : rupiah(amount)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-sm">
                <span className="text-muted">Kembalian</span>
                <strong className="tabular-nums">{cashReceived !== "" && Number.isSafeInteger(Number(cashReceived)) && Number(cashReceived) >= subtotal ? rupiah(Number(cashReceived) - subtotal) : "—"}</strong>
              </div>
            </div>
          )}
          <button type="submit" disabled={cart.length === 0 || products.length === 0 || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-bold text-white shadow-soft transition active:scale-[0.99] hover:bg-[#196640] disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Menyimpan transaksi…" : <><CheckCircle2 size={17} /> Simpan transaksi</>}
          </button>
          <p className="text-center text-[11px] leading-4 text-muted">Harga dan stok diverifikasi ulang saat transaksi disimpan.</p>
        </form>
      </div>
    </>
  );

  const cartPanel = (
    <section className="h-fit rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="font-bold">Keranjang</h2><p className="mt-1 text-xs text-muted">{itemCount} barang · {cart.length} jenis</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ShoppingCart size={19} /></span>
      </div>
      {cartContent}
    </section>
  );

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand">Mode kasir</p>
              <h2 className="mt-1 text-lg font-bold">Pilih produk</h2>
              <p className="mt-1 text-xs text-muted">{filteredProducts.length} dari {products.length} produk aktif</p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><ShoppingCart size={20} /></span>
          </div>

          <label className="relative mb-3 block">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama produk atau scan SKU…" aria-label="Cari produk"
              className="w-full rounded-xl border border-line bg-canvas py-3 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10" />
          </label>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter kategori">
            <button type="button" onClick={() => setCategoryId("all")} aria-pressed={categoryId === "all"}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${categoryId === "all" ? "border-brand bg-brand text-white" : "border-line bg-white text-muted"}`}>
              Semua
            </button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} aria-pressed={categoryId === category.id}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${categoryId === category.id ? "border-brand bg-brand text-white" : "border-line bg-white text-muted"}`}>
                {category.name}
              </button>
            ))}
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
              <ShoppingCart size={27} className="mx-auto text-muted" />
              <p className="mt-3 font-semibold">Katalog masih kosong</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-muted">Tambahkan produk satu kali. Setelah itu, kasir cukup ketuk barang untuk memasukkannya ke transaksi.</p>
              <Link href="/products" className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Tambah produk</Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Produk tidak ditemukan. Coba kata kunci atau kategori lain.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const outOfStock = product.track_stock && (product.stock_qty ?? 0) < 1;
                const quantityInCart = cart.find((line) => line.productId === product.id)?.quantity ?? 0;
                return (
                  <button key={product.id} type="button" disabled={outOfStock} onClick={() => addProduct(product)}
                    className="group relative flex min-h-32 flex-col rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand hover:bg-brand-soft/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45">
                    {quantityInCart > 0 && <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{quantityInCart}</span>}
                    <span className="line-clamp-2 pr-7 text-sm font-semibold leading-5">{product.name}</span>
                    <span className="mt-1 text-[11px] text-muted">{product.sku || product.unit}</span>
                    <span className="mt-auto pt-4 text-sm font-extrabold text-brand">{rupiah(Number(product.price))}</span>
                    {outOfStock ? <span className="mt-1 text-[11px] font-semibold text-red-600">Stok habis</span> : product.track_stock && <span className="mt-1 text-[11px] text-muted">Stok {product.stock_qty ?? 0}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
        <div className="hidden xl:block">{cartPanel}</div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 xl:hidden">
        <button type="button" onClick={() => setCartOpen(true)} disabled={itemCount === 0}
          className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[#172d22] px-4 py-3.5 text-left text-white shadow-[0_8px_32px_rgba(15,35,24,0.28)] disabled:cursor-not-allowed disabled:bg-slate-500">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><ShoppingCart size={18} /></span>
            <span className="min-w-0"><span className="block text-xs text-white/70">{itemCount} barang · {cart.length} jenis</span><strong className="block truncate text-sm">Lihat keranjang</strong></span>
          </span>
          <strong className="shrink-0 text-base tabular-nums">{rupiah(subtotal)}</strong>
        </button>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-cart-title"
            className="max-h-[94dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:px-6">
            <div className="mx-auto max-w-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-brand">Transaksi berjalan</p><h2 id="mobile-cart-title" className="mt-1 text-xl font-bold">Keranjang & pembayaran</h2></div>
                <button type="button" aria-label="Tutup keranjang" onClick={() => setCartOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted"><X size={19} /></button>
              </div>
              <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><p className="text-sm font-bold">{itemCount} barang</p><p className="mt-1 text-xs text-muted">{cart.length} jenis produk</p></div>
                  <strong className="text-lg tabular-nums">{rupiah(subtotal)}</strong>
                </div>
                {cartContent}
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
