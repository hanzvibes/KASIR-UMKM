import Link from "next/link";
import { Boxes, PackagePlus, Tags } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import VariantEditor from "./variant-editor";
import { createCategory, updateCategory, deleteCategory, createProduct, updateProduct, setProductActive, archiveProduct } from "./actions";

type SearchParams = Promise<{ error?: string; success?: string; search?: string; page?: string }>;

const successMessages: Record<string, string> = {
  category_created: "Kategori berhasil ditambahkan.",
  category_updated: "Kategori berhasil diperbarui.",
  category_deleted: "Kategori berhasil dihapus.",
  product_created: "Produk berhasil ditambahkan.",
  product_updated: "Produk berhasil diperbarui.",
  product_activated: "Produk diaktifkan.",
  product_deactivated: "Produk dinonaktifkan.",
  product_archived: "Produk diarsipkan. Riwayat penjualan tetap tersimpan.",
  variants_saved: "Varian produk berhasil disimpan.",
};

const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [
    { data: { user }, error: authError },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (authError || !user) redirect("/login");
  const membership = memberships?.[0];
  if (membershipError || !membership) redirect("/onboarding");

  const searchTerm = (params.search ?? "").trim().replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80);
  const searchWords = searchTerm.split(/\s+/).filter((word) => word.length > 1).slice(0, 6);
  if (searchWords.length === 0 && searchTerm) searchWords.push(searchTerm);
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
  const pageSize = 30;
  let productQuery = supabase.from("kasir_products").select("id, name, sku, category_id, unit, price, cost_price, stock_qty, track_stock, is_active")
    .eq("business_id", membership.business_id).is("deleted_at", null);
  if (searchWords.length > 0) productQuery = productQuery.or(searchWords.flatMap((word) => [`name.ilike.%${word}%`, `sku.ilike.%${word}%`]).join(","));

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("kasir_categories").select("id, name").eq("business_id", membership.business_id).order("name"),
    productQuery.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize),
  ]);

  const categoryList = categories ?? [];
  const fetchedProducts = products ?? [];
  const hasNextPage = fetchedProducts.length > pageSize;
  const productList = fetchedProducts.slice(0, pageSize);
  const productIds = productList.map((product) => product.id);
  const { data: variantGroups, error: variantsError } = productIds.length
    ? await supabase.from("kasir_product_variant_groups").select("id, product_id, name, required").eq("business_id", membership.business_id).in("product_id", productIds)
    : { data: [], error: null };
  const groupIds = (variantGroups ?? []).map((group) => group.id);
  const { data: variantOptions, error: optionsError } = groupIds.length
    ? await supabase.from("kasir_product_variant_options").select("group_id, name, price_delta").eq("business_id", membership.business_id).in("group_id", groupIds).order("name")
    : { data: [], error: null };
  const productVariants = new Map((variantGroups ?? []).map((group) => [group.product_id, {
    name: group.name,
    required: group.required,
    options: (variantOptions ?? []).filter((option) => option.group_id === group.id).map((option) => ({ name: option.name, price_delta: Number(option.price_delta) })),
  }]));
  const categoryNames = new Map(categoryList.map((category) => [category.id, category.name]));
  const canManage = membership.role === "owner";
  const pageHref = (nextPage: number) => `/products?${new URLSearchParams({ ...(searchTerm ? { search: searchTerm } : {}), page: String(nextPage) })}`;

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <PageHeader title="Produk & stok" subtitle="Katalog, harga, kategori, dan varian." backHref="/manage" width="max-w-7xl" />

      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-7">
        {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}
        {params.success && successMessages[params.success] && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{successMessages[params.success]}</p>}
        {(categoriesError || productsError || variantsError || optionsError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data produk, kategori, atau varian gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database dan migrasi.</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><PackagePlus size={20} /></span>
              <div><h2 className="font-semibold">Tambah produk</h2><p className="text-sm text-muted">Harga dalam rupiah.</p></div>
            </div>
            {canManage ? (
              <form action={createProduct} className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Nama produk *
                  <input name="name" required maxLength={160} placeholder="Contoh: Kopi susu" className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">SKU (opsional)
                  <input name="sku" maxLength={80} placeholder="KOP-001" className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Kategori
                  <select name="category_id" defaultValue="" className="rounded-xl border border-line bg-white px-3 py-2.5 font-normal">
                    <option value="">Tanpa kategori</option>{categoryList.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Harga jual (Rp) *
                  <input name="price" type="number" min="0" step="1" required placeholder="15000" className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Harga modal (Rp)
                  <input name="cost_price" type="number" min="0" step="1" placeholder="8000" className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Satuan
                  <input name="unit" defaultValue="pcs" maxLength={24} required className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Jumlah stok awal
                  <input name="stock_qty" type="number" min="0" step="0.001" placeholder="Kosongkan jika tidak dilacak" className="rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-brand" />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="track_stock" type="checkbox" className="accent-brand" /> Aktifkan pelacakan stok (jumlah stok wajib diisi)</label>
                <button className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-[#196640] sm:col-span-2">Simpan produk</button>
              </form>
            ) : <p className="text-sm text-muted">Akun kasir hanya dapat melihat katalog. Hubungi pemilik usaha untuk mengubah produk.</p>}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Tags size={20} /></span>
              <div><h2 className="font-semibold">Kategori</h2><p className="text-sm text-muted">{categoryList.length} kategori</p></div>
            </div>
            {canManage && <form action={createCategory} className="mb-5 flex gap-2">
              <input name="name" required maxLength={80} placeholder="Nama kategori baru" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" />
              <button className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Tambah</button>
            </form>}
            {categoryList.length === 0 ? <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">Belum ada kategori.</p> : (
              <ul className="space-y-3">{categoryList.map((category) => (
                <li key={category.id} className="rounded-xl border border-line p-3">
                  {canManage ? <div className="space-y-2">
                    <form action={updateCategory} className="flex gap-2"><input type="hidden" name="id" value={category.id} /><input name="name" required maxLength={80} defaultValue={category.name} aria-label={`Nama kategori ${category.name}`} className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-2 text-sm" /><button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">Simpan</button></form>
                    <form action={deleteCategory}><input type="hidden" name="id" value={category.id} /><button className="text-xs font-medium text-red-600">Hapus kategori</button></form>
                  </div> : <p className="text-sm font-medium">{category.name}</p>}
                </li>
              ))}</ul>
            )}
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><span className="rounded-lg bg-canvas p-2 text-muted"><Boxes size={18} /></span><div><h2 className="font-semibold">Daftar produk</h2><p className="mt-1 text-sm text-muted">{searchTerm ? `${productList.length} hasil di halaman ${page}` : `${productList.length} produk di halaman ${page}`}</p></div></div><form action="/products" method="get" role="search" className="flex w-full gap-2 sm:max-w-sm"><input name="search" type="search" defaultValue={searchTerm} aria-label="Cari produk" placeholder="Cari nama atau SKU…" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm" /><button className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold hover:bg-canvas">Cari</button></form></div>
          {productList.length === 0 && !searchTerm && page === 1 ? <div className="p-10 text-center"><p className="font-semibold">Belum ada produk</p><p className="mt-1 text-sm text-muted">Tambahkan produk lewat formulir di atas.</p></div> : productList.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">{page > 1 && !searchTerm ? "Tidak ada produk di halaman ini" : "Produk tidak ditemukan"}</p><p className="mt-1 text-sm text-muted">Coba kata kunci lain atau kembali ke halaman sebelumnya.</p><div className="mt-4 flex justify-center gap-2">{page > 1 && <Link href={pageHref(page - 1)} className="inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-canvas">Sebelumnya</Link>}{searchTerm && <Link href="/products" className="inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-canvas">Hapus pencarian</Link>}</div></div> : (
            <div className="divide-y divide-line">
              {productList.map((product) => (
                <details key={product.id} className="group p-4 sm:p-5">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-brand"><PackagePlus size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{product.name}</span><span className="mt-1 block text-xs text-muted">{categoryNames.get(product.category_id ?? "") ?? "Tanpa kategori"} · {product.sku || "Tanpa SKU"}{product.track_stock ? ` · Stok ${product.stock_qty ?? 0} ${product.unit}` : " · Stok tidak dilacak"}</span></span>
                    <span className="text-right"><span className="block text-sm font-semibold">{money(product.price)}</span><span className={`mt-1 block text-xs ${product.is_active ? "text-green-700" : "text-muted"}`}>{product.is_active ? "Aktif" : "Nonaktif"}</span></span>
                  </summary>
                  {canManage && <form action={updateProduct} className="mt-4 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={product.id} />
                    <label className="grid gap-1 text-xs font-semibold">Nama<input name="name" defaultValue={product.name} required maxLength={160} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold">SKU<input name="sku" defaultValue={product.sku ?? ""} maxLength={80} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold">Kategori<select name="category_id" defaultValue={product.category_id ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"><option value="">Tanpa kategori</option>{categoryList.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                    <label className="grid gap-1 text-xs font-semibold">Satuan<input name="unit" defaultValue={product.unit} maxLength={24} required className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold">Harga jual (Rp)<input name="price" type="number" min="0" step="1" defaultValue={product.price} required className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold">Harga modal (Rp)<input name="cost_price" type="number" min="0" step="1" defaultValue={product.cost_price ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold">Stok<input name="stock_qty" type="number" min="0" step="0.001" defaultValue={product.stock_qty ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="flex items-center gap-2 text-xs font-semibold"><input name="track_stock" type="checkbox" defaultChecked={product.track_stock} className="accent-brand" /> Lacak stok</label>
                    <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Simpan perubahan</button>
                  </form>}
                  {canManage ? <div className="mt-4"><h3 className="text-sm font-semibold">Varian / add-on</h3><p className="mt-1 text-xs text-muted">Atur satu kelompok pilihan dengan selisih harga.</p><VariantEditor productId={product.id} basePrice={Number(product.price)} initial={productVariants.get(product.id) ?? null} /></div> : (productVariants.get(product.id)?.options.length ?? 0) > 0 ? <p className="mt-3 text-xs text-muted">Pilihan: {productVariants.get(product.id)?.options.map((option) => option.name).join(", ")}</p> : null}
                  {canManage && <div className="mt-2 flex flex-wrap gap-2"><form action={setProductActive}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(!product.is_active)} /><button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">{product.is_active ? "Nonaktifkan produk" : "Aktifkan produk"}</button></form><form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Arsipkan</button></form></div>}
                </details>
              ))}
            </div>
          )}
          {productList.length > 0 && <nav aria-label="Halaman produk" className="flex items-center justify-between border-t border-line px-5 py-4 sm:px-6"><span className="text-sm text-muted">Halaman {page}</span><div className="flex gap-2">{page > 1 && <Link href={pageHref(page - 1)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Sebelumnya</Link>}{hasNextPage && <Link href={pageHref(page + 1)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Berikutnya</Link>}</div></nav>}
        </section>
      </div>

    </main>
  );
}
