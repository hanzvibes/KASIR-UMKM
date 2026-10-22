import Link from "next/link";
import { ArrowLeft, BarChart3, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function currentJakartaMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const year = Number(part("year"));
  const month = Number(part("month"));
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next, label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${start}T12:00:00+07:00`)) };
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("kasir_business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership) redirect("/onboarding");

  const month = currentJakartaMonth();
  const from = `${month.start}T00:00:00+07:00`;
  const to = `${month.next}T00:00:00+07:00`;
  const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("kasir_sales").select("id, total_amount, created_at").eq("business_id", membership.business_id).gte("created_at", from).lt("created_at", to),
    supabase.from("kasir_expenses").select("amount, expense_date").eq("business_id", membership.business_id).gte("expense_date", month.start).lt("expense_date", month.next),
  ]);

  const saleList = sales ?? [];
  const expenseList = expenses ?? [];
  const revenue = saleList.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const expenseTotal = expenseList.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const salesErrorMessage = salesError ? "Data penjualan belum tersedia. Pastikan tabel kasir_sales tersedia di Supabase development." : null;
  const expensesErrorMessage = expensesError ? "Data pengeluaran belum tersedia. Pastikan tabel kasir_expenses tersedia di Supabase development." : null;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-7"><Link href="/" aria-label="Kembali ke dashboard" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-bold">Laporan usaha</h1><p className="text-sm text-muted">Ringkasan bulan {month.label}.</p></div></div></header>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-7">
        {(salesErrorMessage || expensesErrorMessage) && <div role="alert" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{salesErrorMessage && <p>{salesErrorMessage}</p>}{expensesErrorMessage && <p>{expensesErrorMessage}</p>}</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Penjualan tercatat</p><span className="rounded-xl bg-brand-soft p-2 text-brand"><TrendingUp size={18} /></span></div><p className="mt-4 text-2xl font-bold">{money(revenue)}</p><p className="mt-1 text-xs text-muted">{saleList.length} transaksi tercatat</p></article>
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Pengeluaran</p><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><TrendingDown size={18} /></span></div><p className="mt-4 text-2xl font-bold">{money(expenseTotal)}</p><p className="mt-1 text-xs text-muted">{expenseList.length} catatan pengeluaran</p></article>
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Selisih sederhana</p><span className="rounded-xl bg-canvas p-2 text-muted"><BarChart3 size={18} /></span></div><p className={`mt-4 text-2xl font-bold ${revenue - expenseTotal < 0 ? "text-red-700" : "text-ink"}`}>{money(revenue - expenseTotal)}</p><p className="mt-1 text-xs text-muted">Penjualan dikurangi pengeluaran tercatat</p></article>
        </div>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={19} /></span><div><h2 className="font-semibold">Catatan laporan</h2><p className="text-sm text-muted">Periode 1 sampai akhir bulan berjalan.</p></div></div><p className="text-sm leading-6 text-muted">Angka ini adalah ringkasan arus penjualan dan pengeluaran yang tercatat, bukan laba bersih akuntansi. Belum memasukkan HPP lengkap, pajak, biaya pembayaran, atau transaksi yang belum dicatat.</p><Link href="/sales" className="mt-4 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-canvas">Lihat transaksi</Link><Link href="/expenses" className="ml-2 mt-4 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-canvas">Lihat pengeluaran</Link></section>
      </div>
    </main>
  );
}
