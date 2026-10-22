import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ page?: string }>;

const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function SalesHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
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

  const { data: fetchedSales, error } = await supabase.from("kasir_sales")
    .select("id, payment_method, total_amount, created_at, status")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize);
  const hasNextPage = (fetchedSales?.length ?? 0) > pageSize;
  const sales = (fetchedSales ?? []).slice(0, pageSize);

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-7">
          <Link href="/checkout" aria-label="Kembali ke kasir" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-bold">Riwayat transaksi</h1><p className="text-sm text-muted">Menampilkan maksimal {pageSize} transaksi per halaman.</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl p-4 pb-24 sm:p-7">
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Riwayat transaksi gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database.</p>}
        {!error && (!sales || sales.length === 0) ? <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center"><ReceiptText size={28} className="mx-auto text-muted" /><h2 className="mt-3 font-semibold">{page > 1 ? "Tidak ada transaksi di halaman ini" : "Belum ada transaksi"}</h2><p className="mt-1 text-sm text-muted">{page > 1 ? "Coba halaman sebelumnya untuk melihat transaksi." : "Transaksi yang disimpan akan muncul di sini."}</p><Link href={page > 1 ? `/sales?page=${page - 1}` : "/checkout"} className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">{page > 1 ? "Halaman sebelumnya" : "Buka kasir"}</Link></div> : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {(sales ?? []).map((sale) => <Link key={sale.id} href={`/sales/${sale.id}`} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0 hover:bg-canvas sm:px-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Struk #{sale.id.slice(0, 8)}</span><span className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at))} · {sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "Lainnya"}</span></span>
              <span className="text-right"><span className="block text-sm font-bold">{money(sale.total_amount)}</span><span className={`mt-1 block text-xs ${sale.status === "voided" ? "text-red-700" : "text-green-700"}`}>{sale.status === "voided" ? "Dibatalkan" : "Tersimpan"}</span></span>
            </Link>)}
              {(sales?.length ?? 0) > 0 && <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5"><span className="text-sm text-muted">Halaman {page}</span><div className="flex gap-2">{page > 1 && <Link href={`/sales?page=${page - 1}`} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Sebelumnya</Link>}{hasNextPage && <Link href={`/sales?page=${page + 1}`} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">Berikutnya</Link>}</div></div>}
          </div>
        )}
      </div>

    </main>
  );
}
