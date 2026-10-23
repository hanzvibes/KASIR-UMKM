import Link from "next/link";
import { ReceiptText, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import { sanitizeSearchTerm } from "@/lib/pos";
import SalesFilters from "./sales-filters";

type SearchParams = Promise<{ page?: string; q?: string }>;

export default async function SalesHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
  const searchTerm = sanitizeSearchTerm(params.q ?? "", 60);
  const pageSize = 30;
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

  let salesQuery = supabase.from("kasir_sales")
    .select("id, invoice_no, payment_method, total_amount, created_at, status")
    .eq("business_id", membership.business_id);
  if (searchTerm) salesQuery = salesQuery.ilike("invoice_no", `%${searchTerm}%`);
  const { data: fetchedSales, error } = await salesQuery
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize);
  const hasNextPage = (fetchedSales?.length ?? 0) > pageSize;
  const sales = (fetchedSales ?? []).slice(0, pageSize);

  const pageSales = sales.map((sale) => ({ ...sale, total_amount: Number(sale.total_amount) }));
  const pageHref = (nextPage: number) =>
    `/sales?${new URLSearchParams({ ...(searchTerm ? { q: searchTerm } : {}), page: String(nextPage) })}`;

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <PageHeader title="Transaksi" subtitle="Cari nomor invoice, lalu saring status dan metode pembayaran." width="max-w-5xl" />
      <div className="mx-auto max-w-5xl space-y-3 p-4 pb-24 sm:p-7">
        <form action="/sales" method="get" role="search" className="rounded-2xl border border-line bg-white p-3 shadow-soft">
          <label htmlFor="sale-search" className="sr-only">Cari nomor invoice</label>
          <div className="flex gap-2">
            <input
              id="sale-search"
              name="q"
              type="search"
              defaultValue={searchTerm}
              maxLength={60}
              placeholder="Cari nomor invoice (INV-…)"
              className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-[#196640]">
              <Search size={16} aria-hidden="true" /> Cari
            </button>
          </div>
          {searchTerm && (
            <p className="mt-2 px-1 text-xs text-muted">
              Hasil untuk “{searchTerm}”. <Link href="/sales" className="font-semibold text-brand underline">Hapus pencarian</Link>
            </p>
          )}
        </form>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Riwayat transaksi gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database.</p>}
        {!error && pageSales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <ReceiptText size={28} className="mx-auto text-muted" />
            <h2 className="mt-3 font-semibold">
              {searchTerm ? "Transaksi tidak ditemukan" : page > 1 ? "Tidak ada transaksi di halaman ini" : "Belum ada transaksi"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {searchTerm
                ? "Periksa kembali nomor invoice pada struk, atau hapus pencarian untuk melihat semua transaksi."
                : page > 1
                  ? "Coba halaman sebelumnya untuk melihat transaksi."
                  : "Transaksi yang disimpan akan muncul di sini."}
            </p>
            {searchTerm ? (
              <Link href="/sales" className="mt-5 inline-flex rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-canvas">Hapus pencarian</Link>
            ) : (
              <Link href={page > 1 ? pageHref(page - 1) : "/checkout"} className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
                {page > 1 ? "Halaman sebelumnya" : "Buka kasir"}
              </Link>
            )}
          </div>
        ) : !error ? <SalesFilters sales={pageSales} /> : null}
        {!error && pageSales.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <span className="text-sm text-muted">Halaman {page}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={pageHref(page - 1)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Sebelumnya</Link>}
              {hasNextPage && <Link href={pageHref(page + 1)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Berikutnya</Link>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
