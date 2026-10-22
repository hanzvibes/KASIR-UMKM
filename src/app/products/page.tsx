import Link from "next/link";
import { ArrowLeft, Boxes, PackagePlus, Tags } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCategory, updateCategory, deleteCategory, createProduct, updateProduct, setProductActive } from "./actions";

type SearchParams = Promise<{ error?: string; success?: string }>;

const successMessages: Record<string, string> = {
  category_created: "Kategori berhasil ditambahkan.",
  category_updated: "Kategori berhasil diperbarui.",
  category_deleted: "Kategori berhasil dihapus.",
  product_created: "Produk berhasil ditambahkan.",
  product_updated: "Produk berhasil diperbarui.",
  product_activated: "Produk diaktifkan.",
  product_deactivated: "Produk dinonaktifkan.",
};

const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
  const membership = memberships?.[0];
  if (membershipError || !membership) redirect("/onboarding");

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("kasir_categories").select("id, name").eq("business_id", membership.business_id).order("name"),
    supabase.from("kasir_products").select("id, name, sku, category_id, unit, price, cost_price, stock_qty, track_stock, is_active")
      .eq("business_id", membership.business_id).order("created_at", { ascending: false }),
  ]);

  const categoryList = categories ?? [];
  const productList = products ?? [];
  const categoryNames = new Map(categoryList.map((category) => [category.id, category.name]));
  const canManage = membership.role === "owner";

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-7">
          <Link href="/" aria-label="Kembali ke dashboard" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-bold">Produk & kategori</h1><p className="text-sm text-muted">Kelola katalog barang dan harga jual.</p></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-7">
        {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}
        {params.success && successMessages[params.success] && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{successMessages[params.success]}</p>}
        {(categoriesError || productsError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data belum bisa dimuat. Pastikan migrasi database sudah diterapkan di project Supabase development.</p>}

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
          <div className="flex items-center justify-between border-b border-line p-5 sm:px-6"><div><h2 className="font-semibold">Daftar produk</h2><p className="mt-1 text-sm text-muted">{productList.length} produk terdaftar</p></div><span className="rounded-lg bg-canvas p-2 text-muted"><Boxes size={18} /></span></div>
          {productList.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">Belum ada produk</p><p className="mt-1 text-sm text-muted">Tambahkan produk lewat formulir di atas.</p></div> : (
            <div className="divide-y divide-line">
              {productList.map((product) => (
                <details key={product.id} className="group p-4 sm:p-5">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-brand"><PackagePlus size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{product.name}</span><span className="mt-1 block text-xs text-muted">{categoryNames.get(product.category_id ?? "") ?? "Tanpa kategori"} · {product.sku || "Tanpa SKU"}</span></span>
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
                  {canManage && <form action={setProductActive} className="mt-2"><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(!product.is_active)} /><button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">{product.is_active ? "Nonaktifkan produk" : "Aktifkan produk"}</button></form>}
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
