"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Search, ShoppingCart, Trash2, X, CheckCircle2, Star, Sparkles } from "lucide-react";
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
type CatalogPreferences = { favorites: string[]; picks: Record<string, number> };

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function CheckoutClient({
  products,
  categories,
  businessId,
  qrisImageUrl,
  idempotencyKey,
  errorMessage,
  clearDraft = false,
  successSaleId,
  dataError = false,
}: {
  products: Product[];
  categories: Category[];
  businessId: string;
  qrisImageUrl: string | null;
  idempotencyKey: string;
  errorMessage?: string;
  clearDraft?: boolean;
  successSaleId?: string;
  dataError?: boolean;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState(idempotencyKey);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discount, setDiscount] = useState("0");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const clearedSuccessDraft = useRef(false);
  const [catalogPreferences, setCatalogPreferences] = useState<CatalogPreferences>({ favorites: [], picks: {} });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const draftKey = `kasir-umkm:checkout-draft-v1:${businessId}`;
  const legacyDraftKey = "kasir-umkm:checkout-draft-v1";
  const successMarkerKey = `kasir-umkm:checkout-cleared-sale-v1:${businessId}`;
  const preferencesKey = `kasir-umkm:catalog-preferences-v1:${businessId}`;
  const offlineProductsKey = `kasir-umkm:offline-products-v1:${businessId}`;

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
  const discountAmount = /^\d+$/.test(discount) && Number.isSafeInteger(Number(discount)) ? Number(discount) : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const quickCashAmounts = [...new Set([
    total,
    Math.ceil(total / 10_000) * 10_000,
    Math.ceil(total / 20_000) * 20_000,
    50_000,
    100_000,
  ].filter((amount) => amount >= subtotal && amount > 0))];
  const quickProducts = products
    .filter((product) => !product.track_stock || (product.stock_qty ?? 0) > 0)
    .filter((product) => categoryId === "all" || product.category_id === categoryId)
    .filter((product) => catalogPreferences.favorites.includes(product.id) || (catalogPreferences.picks[product.id] ?? 0) > 0)
    .sort((a, b) => Number(catalogPreferences.favorites.includes(b.id)) - Number(catalogPreferences.favorites.includes(a.id))
      || (catalogPreferences.picks[b.id] ?? 0) - (catalogPreferences.picks[a.id] ?? 0))
    .slice(0, 8);

  useEffect(() => {
    try {
      if (clearDraft) {
        clearedSuccessDraft.current = true;
        const handledSaleId = sessionStorage.getItem(successMarkerKey);
        if (successSaleId && handledSaleId !== successSaleId) {
          sessionStorage.removeItem(draftKey);
          sessionStorage.removeItem(legacyDraftKey);
          sessionStorage.setItem(successMarkerKey, successSaleId);
          // This effect hydrates browser storage after a successful server action.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCart([]);
          setActiveIdempotencyKey(idempotencyKey);
          setPaymentMethod("cash");
          setCashReceived("");
          return;
        }
      }
      let raw = sessionStorage.getItem(draftKey);
      if (!raw) {
        raw = sessionStorage.getItem(legacyDraftKey);
        if (raw) {
          sessionStorage.setItem(draftKey, raw);
          sessionStorage.removeItem(legacyDraftKey);
        }
      }
      if (!raw) return;
      const draft = JSON.parse(raw) as { items?: unknown; idempotencyKey?: unknown; paymentMethod?: unknown; cashReceived?: unknown };
      if (Array.isArray(draft.items)) {
        const restored = draft.items.filter((item): item is CartLine =>
          !!item && typeof item === "object" && "productId" in item && "quantity" in item
          && typeof item.productId === "string" && productById.has(item.productId)
          && typeof item.quantity === "number" && Number.isFinite(item.quantity)
          && item.quantity > 0 && item.quantity <= 1_000_000
          && (!productById.get(item.productId)?.track_stock || (productById.get(item.productId)?.stock_qty !== null
            && item.quantity <= Number(productById.get(item.productId)?.stock_qty ?? 0)))
        );
        setCart(restored);
        setDraftRestored(restored.length > 0);
        if (typeof draft.idempotencyKey === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.idempotencyKey)) {
          setActiveIdempotencyKey(draft.idempotencyKey);
        }
        if (draft.paymentMethod === "cash" || draft.paymentMethod === "transfer" || draft.paymentMethod === "qris") setPaymentMethod(draft.paymentMethod);
        if (typeof draft.cashReceived === "string" && /^[0-9]*$/.test(draft.cashReceived)) setCashReceived(draft.cashReceived);
      }
    } catch {
      // Ignore a malformed local draft; server validation remains authoritative.
    } finally {
      setDraftReady(true);
    }
  }, [clearDraft, draftKey, idempotencyKey, legacyDraftKey, productById, successMarkerKey, successSaleId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(preferencesKey);
      if (raw) {
        const value = JSON.parse(raw) as Partial<CatalogPreferences>;
        const picks: Record<string, number> = value.picks && typeof value.picks === "object"
          ? Object.fromEntries(Object.entries(value.picks).filter(([id, count]) => productById.has(id) && typeof count === "number" && Number.isSafeInteger(count) && count > 0)) as Record<string, number>
          : {};
        // This effect hydrates per-device preferences after client mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCatalogPreferences({
          favorites: Array.isArray(value.favorites) ? value.favorites.filter((id): id is string => typeof id === "string" && productById.has(id)) : [],
          picks,
        });
      }
    } catch {
      // A malformed local preference should not block checkout.
    } finally {
      setPreferencesReady(true);
    }
  }, [preferencesKey, productById]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      if ((clearDraft && !clearedSuccessDraft.current) || cart.length === 0) {
        sessionStorage.removeItem(draftKey);
        return;
      }
      sessionStorage.setItem(draftKey, JSON.stringify({ items: cart, idempotencyKey: activeIdempotencyKey, paymentMethod, cashReceived }));
    } catch {
      // Checkout remains usable when browser storage is unavailable.
    }
  }, [activeIdempotencyKey, cart, cashReceived, clearDraft, draftKey, draftReady, paymentMethod]);

  useEffect(() => {
    try {
      localStorage.setItem(offlineProductsKey, JSON.stringify(products.map(({ id, name, sku, unit, price, stock_qty }) => ({ id, name, sku, unit, price, stock_qty }))));
      localStorage.setItem("kasir-umkm:offline-active-business-v1", businessId);
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith("kasir-umkm:offline-products-v1:") && key !== offlineProductsKey) localStorage.removeItem(key);
      }
    } catch {
      // The online checkout remains available if local product storage is full or blocked.
    }
  }, [businessId, offlineProductsKey, products]);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(catalogPreferences));
    } catch {
      // Favorites are a convenience; storage restrictions should not block sales.
    }
  }, [catalogPreferences, preferencesKey, preferencesReady]);

  useEffect(() => {
    if (!cartOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen]);

  function addProduct(product: Product) {
    const currentQuantity = cart.find((line) => line.productId === product.id)?.quantity ?? 0;
    if (product.track_stock && (product.stock_qty ?? 0) < currentQuantity + 1) return;
    setCatalogPreferences((current) => ({
      ...current,
      picks: { ...current.picks, [product.id]: Math.min((current.picks[product.id] ?? 0) + 1, 10_000) },
    }));
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

  function toggleFavorite(productId: string) {
    setCatalogPreferences((current) => ({
      ...current,
      favorites: current.favorites.includes(productId)
        ? current.favorites.filter((id) => id !== productId)
        : [...current.favorites, productId],
    }));
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
    if (!navigator.onLine) {
      event.preventDefault();
      return;
    }
    if (submitting || cart.length === 0) {
      event.preventDefault();
      return;
    }
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        items: cart,
        idempotencyKey: activeIdempotencyKey,
        paymentMethod,
        cashReceived,
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
          <strong className="text-2xl font-bold tracking-tight tabular-nums">{rupiah(total)}</strong>
        </div>
        <form action={checkoutAction} onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input type="hidden" name="items" value={serializedItems} />
          <input type="hidden" name="idempotency_key" value={activeIdempotencyKey} />
          <label className="grid gap-1.5 text-sm font-medium">Diskon (Rp, opsional)
            <input name="discount" type="number" min="0" max={subtotal} step="1" value={discount} onChange={(event) => setDiscount(event.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 font-normal" />
          </label>
          <div className="grid grid-cols-3 gap-2" aria-label="Metode pembayaran">
            {[
              { value: "cash", label: "Tunai" },
              { value: "transfer", label: "Transfer" },
              { value: "qris", label: "QRIS" },
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
                <input name="cash_received" type="number" inputMode="numeric" min={total} step="1" required
                  value={cashReceived} onChange={(event) => setCashReceived(event.target.value)}
                  placeholder={String(total || 0)} className="w-full rounded-xl border border-line px-3 py-3 text-base font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
              </label>
              {total > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => (
                    <button key={amount} type="button" onClick={() => setCashReceived(String(amount))}
                      className="min-h-10 rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted active:bg-canvas">
                        {amount === total ? "Uang pas" : rupiah(amount)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-sm">
                <span className="text-muted">Kembalian</span>
                <strong className="tabular-nums">{cashReceived !== "" && Number.isSafeInteger(Number(cashReceived)) && Number(cashReceived) >= total ? rupiah(Number(cashReceived) - total) : "—"}</strong>
              </div>
            </div>
          )}
          {paymentMethod === "qris" && <div className="rounded-xl border border-line bg-white p-3 text-center">{qrisImageUrl ? <Image src={qrisImageUrl} alt="QRIS usaha" width={240} height={240} unoptimized className="mx-auto max-h-60 w-auto object-contain" /> : <p className="text-sm text-muted">Gambar QRIS belum diatur. Tambahkan di Pengaturan usaha.</p>}<p className="mt-2 text-sm font-semibold">Tunjukkan QRIS ini kepada pelanggan</p></div>}
          <button type="submit" disabled={cart.length === 0 || products.length === 0 || submitting || !online}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-bold text-white shadow-soft transition active:scale-[0.99] hover:bg-[#196640] disabled:cursor-not-allowed disabled:opacity-50">
            {!online ? "Checkout tersedia saat online" : submitting ? "Menyimpan transaksi…" : <><CheckCircle2 size={17} /> Simpan transaksi</>}
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
      {draftRestored && itemCount > 0 && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Keranjang sebelumnya dipulihkan. Periksa kembali jumlah barang dan stok sebelum menyimpan.</p>}
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
              placeholder="Cari nama produk atau SKU…" aria-label="Cari produk"
              className="w-full rounded-xl border border-line bg-canvas py-3 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10" />
          </label>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter kategori">
            <button type="button" onClick={() => setCategoryId("all")} aria-pressed={categoryId === "all"}
              className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${categoryId === "all" ? "border-brand bg-brand text-white" : "border-line bg-white text-muted"}`}>
              Semua
            </button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} aria-pressed={categoryId === category.id}
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors ${categoryId === category.id ? "border-brand bg-brand text-white" : "border-line bg-white text-muted"}`}>
                {category.name}
              </button>
            ))}
          </div>

          {quickProducts.length > 0 && !search.trim() && <section aria-label="Produk pilihan cepat" className="mb-5 rounded-2xl bg-brand-soft/55 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={16} className="text-brand" /><h3 className="text-sm font-bold">Pilihan cepat</h3><span className="text-xs text-muted">Favorit dan sering dipilih di perangkat ini</span></div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickProducts.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex min-w-36 max-w-44 flex-col items-start rounded-xl border border-white bg-white px-3 py-2.5 text-left shadow-sm hover:border-brand">
                <span className="line-clamp-1 w-full text-xs font-semibold">{product.name}</span><span className="mt-1 text-xs font-bold text-brand">{rupiah(Number(product.price))}</span>
              </button>)}
            </div>
          </section>}

          {dataError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
              <ShoppingCart size={27} className="mx-auto text-amber-800" />
              <p className="mt-3 font-semibold text-amber-950">Produk belum bisa dimuat</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-amber-900">Ini belum tentu berarti katalog kosong. Muat ulang untuk mencoba lagi.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Muat ulang</button>
            </div>
          ) : products.length === 0 ? (
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
                  <article key={product.id} className={`relative flex min-h-32 flex-col rounded-xl border border-line bg-white transition hover:border-brand ${outOfStock ? "opacity-50" : "hover:bg-brand-soft/30"}`}>
                    <button type="button" disabled={outOfStock} onClick={() => addProduct(product)} aria-label={`Tambah ${product.name} ke keranjang`}
                      className="flex min-h-32 flex-1 flex-col rounded-xl p-3 pr-10 text-left disabled:cursor-not-allowed">
                      {quantityInCart > 0 && <span className="absolute right-10 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{quantityInCart}</span>}
                      <span className="line-clamp-2 text-sm font-semibold leading-5">{product.name}</span>
                      <span className="mt-1 text-[11px] text-muted">{product.sku || product.unit}</span>
                      <span className="mt-auto pt-4 text-sm font-extrabold text-brand">{rupiah(Number(product.price))}</span>
                      {outOfStock ? <span className="mt-1 text-[11px] font-semibold text-red-600">Stok habis</span> : product.track_stock && <span className="mt-1 text-[11px] text-muted">Stok {product.stock_qty ?? 0}</span>}
                    </button>
                    <button type="button" aria-label={`${catalogPreferences.favorites.includes(product.id) ? "Hapus dari" : "Tambah ke"} favorit ${product.name}`} aria-pressed={catalogPreferences.favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)} className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full text-amber-600 hover:bg-amber-50">
                      <Star size={17} fill={catalogPreferences.favorites.includes(product.id) ? "currentColor" : "none"} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <div className="hidden xl:block">{cartPanel}</div>
      </div>

      {itemCount > 0 && <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 xl:hidden">
        <button type="button" onClick={() => setCartOpen(true)} aria-label={`Buka keranjang, ${itemCount} barang, total ${rupiah(subtotal)}`}
          className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[#172d22] px-4 py-3.5 text-left text-white shadow-[0_8px_32px_rgba(15,35,24,0.28)]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><ShoppingCart size={18} /></span>
            <span className="min-w-0"><span className="block text-xs text-white/70">{itemCount} barang · {cart.length} jenis</span><strong className="block truncate text-sm">Lihat keranjang</strong></span>
          </span>
          <strong className="shrink-0 text-base tabular-nums">{rupiah(subtotal)}</strong>
        </button>
      </div>}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
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
