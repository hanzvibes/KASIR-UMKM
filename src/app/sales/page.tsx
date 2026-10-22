import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";

const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function SalesHistoryPage() {
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

  const { data: sales, error } = await supabase.from("kasir_sales")
    .select("id, payment_method, total_amount, created_at, status")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-7">
          <Link href="/" aria-label="Kembali ke dashboard" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-bold">Riwayat transaksi</h1><p className="text-sm text-muted">100 transaksi terbaru.</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl p-4 pb-24 sm:p-7">
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Riwayat belum bisa dimuat. Pastikan migrasi checkout sudah diterapkan di Supabase development.</p>}
        {!error && (!sales || sales.length === 0) ? <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center"><ReceiptText size={28} className="mx-auto text-muted" /><h2 className="mt-3 font-semibold">Belum ada transaksi</h2><p className="mt-1 text-sm text-muted">Transaksi yang disimpan akan muncul di sini.</p><Link href="/checkout" className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">Buka kasir</Link></div> : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {(sales ?? []).map((sale) => <Link key={sale.id} href={`/sales/${sale.id}`} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0 hover:bg-canvas sm:px-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Struk #{sale.id.slice(0, 8)}</span><span className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at))} · {sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "Lainnya"}</span></span>
              <span className="text-right"><span className="block text-sm font-bold">{money(sale.total_amount)}</span><span className={`mt-1 block text-xs ${sale.status === "voided" ? "text-red-700" : "text-green-700"}`}>{sale.status === "voided" ? "Dibatalkan" : "Tersimpan"}</span></span>
            </Link>)}
          </div>
        )}
      </div>
      <MobileBottomNav />
    </main>
  );
}
