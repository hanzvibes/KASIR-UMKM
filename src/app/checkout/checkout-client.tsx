"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Minus, Plus, Search, ShoppingCart, Trash2, X, CheckCircle2, Star, Sparkles } from "lucide-react";
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
type VariantOption = { id: string; name: string; price_delta: number };
type VariantGroup = { product_id: string; name: string; required: boolean; options: VariantOption[] };
type CartLine = { productId: string; variantOptionId: string | null; quantity: number };
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
  variants,
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
  variants: VariantGroup[];
  businessId: string;
  qrisImageUrl: string | null;
  idempotencyKey: string;
  errorMessage?: string;
  clearDraft?: boolean;
  successSaleId?: string;
  dataError?: boolean;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantProductId, setVariantProductId] = useState<string | null>(null);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState(idempotencyKey);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discount, setDiscount] = useState("0");
  const [search, setSearch] = useState("");
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
  const variantByProductId = useMemo(() => new Map(variants.map((variant) => [variant.product_id, variant])), [variants]);
  const optionById = useMemo(() => new Map(variants.flatMap((group) => group.options.map((option) => [option.id, option] as const))), [variants]);
  const cartLineKey = (productId: string, optionId: string | null) => `${productId}:${optionId ?? ""}`;
  const deferredSearch = useDeferredValue(search);
  const filteredProducts = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLocaleLowerCase("id-ID").includes(query)
        || (product.sku ?? "").toLocaleLowerCase("id-ID").includes(query);
      return matchesSearch && (categoryId === "all" || product.category_id === categoryId);
    });
  }, [products, deferredSearch, categoryId]);

  const subtotal = cart.reduce((sum, line) => {
    const product = productById.get(line.productId);
    const option = line.variantOptionId ? optionById.get(line.variantOptionId) : null;
    return sum + Math.round((Number(product?.price ?? 0) + Number(option?.price_delta ?? 0)) * line.quantity);
  }, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const stockConflicts = cart.flatMap((line) => {
    const product = productById.get(line.productId);
    const quantity = cart.filter((item) => item.productId === line.productId).reduce((sum, item) => sum + item.quantity, 0);
    return product?.track_stock && product.stock_qty !== null && quantity > product.stock_qty
      ? [{ name: product.name, available: product.stock_qty, requested: quantity }]
      : [];
  }).filter((conflict, index, list) => list.findIndex((item) => item.name === conflict.name) === index);
  const discountAmount = /^\d+$/.test(discount) && Number.isSafeInteger(Number(discount)) ? Number(discount) : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const cashIsValid = paymentMethod !== "cash" || (cashReceived !== "" && Number.isSafeInteger(Number(cashReceived)) && Number(cashReceived) >= total);
  const discountIsValid = /^\d+$/.test(discount) && Number.isSafeInteger(Number(discount)) && discountAmount <= subtotal;
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
        const restored = draft.items.flatMap((value): CartLine[] => {
          if (!value || typeof value !== "object" || !("productId" in value) || !("quantity" in value)
            || typeof value.productId !== "string" || typeof value.quantity !== "number" || !Number.isFinite(value.quantity)
            || value.quantity <= 0 || value.quantity > 1_000_000) return [];
          const product = productById.get(value.productId);
          if (!product) return [];
          const optionId = "variantOptionId" in value && typeof value.variantOptionId === "string" ? value.variantOptionId : null;
          const group = variantByProductId.get(product.id);
          if (group?.required && !optionId) return [];
          if (optionId && !group?.options.some((option) => option.id === optionId)) return [];
          return [{ productId: product.id, variantOptionId: optionId, quantity: value.quantity }];
        });
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
  }, [clearDraft, draftKey, idempotencyKey, legacyDraftKey, productById, successMarkerKey, successSaleId, variantByProductId]);

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
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    const openPayment = (event: KeyboardEvent) => {
      if (event.key !== "F2" || !cart.length || variantProductId) return;
      event.preventDefault();
      setCartOpen(true);
    };
    window.addEventListener("keydown", focusSearch);
    window.addEventListener("keydown", openPayment);
    return () => {
      window.removeEventListener("keydown", focusSearch);
      window.removeEventListener("keydown", openPayment);
    };
  }, [cart.length, variantProductId]);

  useEffect(() => {
    if (!lastAddedId) return;
    const timer = window.setTimeout(() => setLastAddedId(null), 600);
    return () => window.clearTimeout(timer);
  }, [lastAddedId]);

  useEffect(() => {
    if (!cartOpen && !variantProductId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setVariantProductId(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen, variantProductId]);

  function addProduct(product: Product) {
    const group = variantByProductId.get(product.id);
    if (group?.options.length) {
      setVariantProductId(product.id);
      return;
    }
    addCartLine(product, null);
  }

  function addCartLine(product: Product, variantOptionId: string | null) {
    const currentQuantity = cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
    if (product.track_stock && (product.stock_qty ?? 0) < currentQuantity + 1) return;
    setLastAddedId(product.id);
    navigator.vibrate?.(8);
    setCatalogPreferences((current) => ({
      ...current,
      picks: { ...current.picks, [product.id]: Math.min((current.picks[product.id] ?? 0) + 1, 10_000) },
    }));
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id && line.variantOptionId === variantOptionId);
      if (existing) {
        const nextQuantity = existing.quantity + 1;
        return current.map((line) => line === existing ? { ...line, quantity: nextQuantity } : line);
      }
      return [...current, { productId: product.id, variantOptionId, quantity: 1 }];
    });
    setCashReceived("");
  }

  function chooseVariant(optionId: string | null) {
    const product = variantProductId ? productById.get(variantProductId) : null;
    if (product) addCartLine(product, optionId);
    setVariantProductId(null);
  }

  function clearCart() {
    if (cart.length > 0 && !window.confirm(`Kosongkan ${itemCount} barang dari keranjang?`)) return;
    setCart([]);
    setCashReceived("");
    setDiscount("0");
    setActiveIdempotencyKey(crypto.randomUUID());
  }

  function toggleFavorite(productId: string) {
    setCatalogPreferences((current) => ({
      ...current,
      favorites: current.favorites.includes(productId)
        ? current.favorites.filter((id) => id !== productId)
        : [...current.favorites, productId],
    }));
  }

  function changeQuantity(productId: string, variantOptionId: string | null, quantity: number) {
    const product = productById.get(productId);
    const lineKey = cartLineKey(productId, variantOptionId);
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => cartLineKey(line.productId, line.variantOptionId) !== lineKey));
      setCashReceived("");
      return;
    }
    const otherQuantity = cart.filter((line) => line.productId === productId && line.variantOptionId !== variantOptionId).reduce((sum, line) => sum + line.quantity, 0);
    if (product?.track_stock && product.stock_qty !== null && quantity + otherQuantity > product.stock_qty) return;
    setCart((current) => current.map((line) => cartLineKey(line.productId, line.variantOptionId) === lineKey ? { ...line, quantity } : line));
    setCashReceived("");
  }

  // Barcode scanners and SKU typing end with Enter: add the matching product immediately.
  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const query = search.trim().toLocaleLowerCase("id-ID");
    if (!query) return;
    const exactSku = filteredProducts.find((product) => (product.sku ?? "").toLocaleLowerCase("id-ID") === query);
    const product = exactSku ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (!product) return;
    event.preventDefault();
    addProduct(product);
    setSearch("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!navigator.onLine) {
      event.preventDefault();
      return;
    }
    if (submitting || cart.length === 0 || !cashIsValid || !discountIsValid || stockConflicts.length > 0) {
      event.preventDefault();
      return;
    }
    const paymentLabel = paymentMethod === "cash" ? "Tunai" : paymentMethod === "qris" ? "QRIS" : "Transfer";
    const cashSummary = paymentMethod === "cash" ? `\nUang diterima: ${rupiah(Number(cashReceived))}\nKembalian: ${rupiah(Number(cashReceived) - total)}` : "";
    if (!window.confirm(`Simpan transaksi ini?\n\n${itemCount} barang · ${cart.length} jenis\nSubtotal: ${rupiah(subtotal)}${discountAmount ? `\nDiskon: −${rupiah(discountAmount)}` : ""}\nTotal: ${rupiah(total)}\nPembayaran: ${paymentLabel}${cashSummary}`)) {
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
    variant_option_id: line.variantOptionId,
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
            const option = line.variantOptionId ? optionById.get(line.variantOptionId) : null;
            const unitPrice = Number(product.price) + Number(option?.price_delta ?? 0);
            const productQuantity = cart.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
            const lineKey = cartLineKey(line.productId, line.variantOptionId);
            return (
              <li key={lineKey} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{option ? `${variantByProductId.get(product.id)?.name}: ${option.name} · ` : ""}{rupiah(unitPrice)} / {product.unit}</p>
                  <p className="mt-1 text-sm font-bold">{rupiah(Math.round(unitPrice * line.quantity))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => changeQuantity(product.id, line.variantOptionId, line.quantity - 1)} className="press grid h-10 w-10 place-items-center rounded-lg border border-line bg-white active:bg-canvas"><Minus size={15} /></button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                  <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => changeQuantity(product.id, line.variantOptionId, line.quantity + 1)} disabled={product.track_stock && product.stock_qty !== null && productQuantity >= product.stock_qty} className="press grid h-10 w-10 place-items-center rounded-lg border border-line bg-white active:bg-canvas disabled:opacity-40"><Plus size={15} /></button>
                  <button type="button" aria-label={`Hapus ${product.name}`} onClick={() => changeQuantity(product.id, line.variantOptionId, 0)} className="press grid h-10 w-9 place-items-center rounded-lg text-red-600 active:bg-red-50"><Trash2 size={16} /></button>
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
          <details className="group rounded-xl border border-line bg-white">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold marker:hidden">
              <span>Tambahkan diskon</span>
              <span className="text-xs font-medium text-muted group-open:hidden">Opsional</span>
            </summary>
            <div className="border-t border-line p-3">
              <label className="grid gap-1.5 text-sm font-medium">Diskon dalam rupiah
                <input name="discount" type="number" min="0" max={subtotal} step="1" inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} aria-invalid={!discountIsValid} className="w-full rounded-xl border border-line px-3 py-2.5 font-normal" />
              </label>
              {!discountIsValid && <p role="alert" className="mt-1.5 text-xs text-red-700">Diskon tidak boleh melebihi subtotal {rupiah(subtotal)}.</p>}
            </div>
          </details>
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
          <button type="submit" disabled={cart.length === 0 || products.length === 0 || submitting || !online || !cashIsValid || !discountIsValid || stockConflicts.length > 0}
            className="press flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-bold text-white shadow-soft transition hover:bg-[#196640] disabled:cursor-not-allowed disabled:opacity-50">
            {!online ? "Checkout tersedia saat online" : submitting ? "Menyimpan transaksi…" : <><CheckCircle2 size={17} /> Simpan · {rupiah(total)}</>}
          </button>
          {paymentMethod === "cash" && !cashIsValid && <p className="text-center text-xs text-amber-800">Masukkan uang diterima atau pilih nominal cepat untuk melanjutkan.</p>}
          <p className="text-center text-[11px] leading-4 text-muted">Harga dan stok diverifikasi ulang saat transaksi disimpan.</p>
        </form>
      </div>
    </>
  );

  const cartPanel = (
    <section className="h-fit rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5 xl:sticky xl:top-20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="font-bold">Keranjang</h2><p className="mt-1 text-xs text-muted">{itemCount} barang · {cart.length} jenis</p></div>
        {cart.length > 0 ? (
          <button type="button" onClick={clearCart} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50">Kosongkan</button>
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ShoppingCart size={19} /></span>
        )}
      </div>
      {cartContent}
    </section>
  );

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {lastAddedId ? `${productById.get(lastAddedId)?.name ?? "Produk"} ditambahkan ke keranjang.` : ""}
      </p>
      {variantProductId && variantByProductId.get(variantProductId) && productById.get(variantProductId) && (() => {
        const product = productById.get(variantProductId)!;
        const group = variantByProductId.get(variantProductId)!;
        return <div className="fixed inset-0 z-[60] flex items-end bg-black/45 backdrop-blur-[2px] animate-fade-in" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setVariantProductId(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="variant-picker-title" className="max-h-[80dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up sm:mx-auto sm:max-w-xl sm:rounded-3xl sm:p-6">            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand">Pilihan produk</p>
              <h2 id="variant-picker-title" className="mt-1 text-xl font-bold">{product.name}</h2>
              <p className="mt-1 text-sm text-muted">Pilih {group.name.toLocaleLowerCase("id-ID")} untuk melanjutkan.</p>
            </div>
            <div className="space-y-2">{group.options.map((option) => {
              const price = Number(product.price) + option.price_delta;
              return <button key={option.id} type="button" onClick={() => chooseVariant(option.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left hover:border-brand hover:bg-brand-soft/30"><span className="font-semibold">{option.name}</span><span className="text-sm font-bold tabular-nums">{rupiah(price)}{option.price_delta !== 0 && <span className="ml-1 text-xs font-normal text-muted">({option.price_delta > 0 ? "+" : "−"}{rupiah(Math.abs(option.price_delta))})</span>}</span></button>;
            })}</div>
            {!group.required && <button type="button" onClick={() => chooseVariant(null)} className="mt-2 min-h-12 w-full rounded-xl border border-dashed border-line px-4 text-sm font-semibold text-muted">Tanpa {group.name.toLocaleLowerCase("id-ID")} · {rupiah(Number(product.price))}</button>}
            <button type="button" onClick={() => setVariantProductId(null)} className="mt-4 min-h-11 w-full rounded-xl bg-canvas text-sm font-semibold text-muted">Batal</button>
          </section>
        </div>;
      })()}
      {!online && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-bold">Offline · transaksi nonaktif</p><p className="mt-1">Sambungkan internet untuk checkout.</p></div>}
      {online && <p className="sr-only" role="status">Koneksi internet aktif. Transaksi dapat disimpan.</p>}
      {stockConflicts.length > 0 && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"><p className="font-bold">Stok berubah sejak katalog dimuat</p><ul className="mt-1 list-inside list-disc">{stockConflicts.map((conflict) => <li key={conflict.name}>{conflict.name}: di keranjang {conflict.requested}, stok saat ini {conflict.available}. Kurangi jumlahnya sebelum menyimpan.</li>)}</ul></div>}
      {draftRestored && itemCount > 0 && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Keranjang dipulihkan. Cek jumlah dan stok.</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)] xl:items-start">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Produk</h2>
              <p className="mt-1 text-xs text-muted">{filteredProducts.length} tersedia</p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-brand-soft px-3 py-2 text-xs font-semibold text-brand sm:inline-flex">Cari / · Bayar F2</span>
          </div>

          <div className={`sticky z-10 -mx-4 -mt-1 mb-3 border-b border-line/70 bg-white/95 px-4 pb-2 pt-2 backdrop-blur transition-[top] sm:-mx-5 sm:px-5 ${cartOpen ? "top-0" : "top-16"}`}>
            <label className="relative block">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKeyDown}
                placeholder="Cari nama produk atau SKU…" aria-label="Cari produk"
                className="w-full rounded-xl border border-line bg-canvas py-3 pl-10 pr-12 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10" />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block">/</kbd>
            </label>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Filter kategori">
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
          </div>

          {quickProducts.length > 0 && !search.trim() && <section aria-label="Produk pilihan cepat" className="mb-5 rounded-2xl bg-brand-soft/55 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={16} className="text-brand" /><h3 className="text-sm font-bold">Pilihan cepat</h3><span className="text-xs text-muted">Favorit & sering dipakai</span></div>
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
              <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-amber-900">Coba muat ulang halaman.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Muat ulang</button>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
              <ShoppingCart size={27} className="mx-auto text-muted" />
              <p className="mt-3 font-semibold">Katalog masih kosong</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-muted">Tambahkan produk untuk mulai berjualan.</p>
              <Link href="/products" className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Tambah produk</Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Produk tidak ditemukan. Coba kata kunci atau kategori lain.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const outOfStock = product.track_stock && (product.stock_qty ?? 0) < 1;
                const quantityInCart = cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
                const productVariant = variantByProductId.get(product.id);
                return (
                  <article key={product.id} className={`relative flex min-h-32 flex-col rounded-xl border bg-white transition-all duration-150 ${lastAddedId === product.id ? "border-brand bg-brand-soft/60 shadow-soft" : "border-line hover:border-brand hover:bg-brand-soft/30"} ${outOfStock ? "opacity-50" : ""}`}>
                    <button type="button" disabled={outOfStock} onClick={() => addProduct(product)} aria-label={`Tambah ${product.name} ke keranjang`}
                      className="press flex min-h-32 flex-1 flex-col rounded-xl p-3 pr-10 text-left disabled:cursor-not-allowed">
                      {lastAddedId === product.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white animate-pop"><Check size={13} strokeWidth={3} /></span>}
                      {quantityInCart > 0 && <span key={quantityInCart} className="absolute right-10 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white animate-pop">{quantityInCart}</span>}
                      <span className="line-clamp-2 text-sm font-semibold leading-5">{product.name}</span>
                      <span className="mt-1 text-[11px] text-muted">{product.sku || product.unit}</span>
                      <span className="mt-auto pt-4 text-sm font-extrabold text-brand">{productVariant?.options.length ? `Mulai ${rupiah(Math.min(...productVariant.options.map((option) => Number(product.price) + option.price_delta)))}` : rupiah(Number(product.price))}</span>
                      {productVariant?.options.length ? <span className="mt-1 text-[11px] text-muted">Pilih {productVariant.name.toLocaleLowerCase("id-ID")}</span> : null}
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

      {itemCount > 0 && <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 animate-rise-in xl:hidden">
        <button type="button" onClick={() => setCartOpen(true)} aria-label={`Buka pembayaran, ${itemCount} barang, total ${rupiah(total)}`}
          className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[#172d22] px-4 py-3.5 text-left text-white shadow-[0_8px_32px_rgba(15,35,24,0.28)] active:scale-[0.995]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><ShoppingCart size={18} /><span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[#172d22]">{itemCount}</span></span>
            <span className="min-w-0"><span className="block text-xs text-white/70">Total tagihan</span><strong className="block truncate text-sm">Bayar sekarang</strong></span>
          </span>
          <strong className="shrink-0 text-base tabular-nums">{rupiah(total)}</strong>
        </button>
      </div>}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px] animate-fade-in" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-cart-title"
            className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up sm:px-6">
            <div className="mx-auto max-w-2xl">
              <div className="sticky top-[-1rem] z-10 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <div><p className="text-xs font-bold uppercase tracking-wider text-brand">Transaksi berjalan</p><h2 id="mobile-cart-title" className="mt-1 text-xl font-bold">Keranjang & pembayaran</h2></div>
                <div className="flex items-center gap-1">
                  {cart.length > 0 && <button type="button" onClick={clearCart} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Kosongkan</button>}
                  <button type="button" aria-label="Tutup keranjang" onClick={() => setCartOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-muted"><X size={19} /></button>
                </div>
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
