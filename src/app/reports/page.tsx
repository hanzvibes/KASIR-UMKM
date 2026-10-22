import Link from "next/link";
import { ArrowLeft, BarChart3, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import MobileBottomNav from "@/components/mobile-bottom-nav";
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

function jakartaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function periodRange(period: string) {
  const today = jakartaDate(new Date());
  if (period === "day") return { period, start: today, end: today, label: `hari ini · ${today}` };
  if (period === "week") {
    const todayDate = new Date(`${today}T12:00:00+07:00`);
    const weekday = (todayDate.getUTCDay() + 6) % 7;
    const monday = new Date(todayDate.getTime() - weekday * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const start = jakartaDate(monday);
    const end = jakartaDate(sunday);
    return { period, start, end, label: `${start} – ${end}` };
  }
  const month = currentJakartaMonth();
  const end = new Date(new Date(month.next + "T00:00:00+07:00").getTime() - 86400000);
  return { period: "month", start: month.start, end: jakartaDate(end), label: month.label };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
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

  const params = await searchParams;
  const selectedPeriod = ["day", "week", "month"].includes(params.period ?? "") ? params.period! : "month";
  const range = periodRange(selectedPeriod);
  const from = `${range.start}T00:00:00+07:00`;
  const to = new Date(new Date(`${range.end}T00:00:00+07:00`).getTime() + 86400000).toISOString();
  const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("kasir_sales").select("id, total_amount, created_at").eq("business_id", membership.business_id).eq("status", "completed").gte("created_at", from).lt("created_at", to).range(0,4999),
    supabase.from("kasir_expenses").select("amount, expense_date").eq("business_id", membership.business_id).gte("expense_date", range.start).lte("expense_date", range.end).range(0, 4999),
  ]);

  const saleList = sales ?? [];
  const expenseList = expenses ?? [];
  const revenue = saleList.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const expenseTotal = expenseList.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const { data: saleItems, error: itemsError } = saleList.length ? await supabase.from("kasir_sale_items").select("unit_cost,quantity").eq("business_id", membership.business_id).in("sale_id", saleList.map((sale) => sale.id)).range(0,9999) : { data: [], error: null };
  const cogs = (saleItems ?? []).reduce((sum, item) => sum + Number(item.unit_cost ?? 0) * Number(item.quantity), 0);
  const netProfit = revenue - cogs - expenseTotal;
  const salesErrorMessage = salesError ? "Data penjualan gagal dimuat." : null;
  const expensesErrorMessage = expensesError ? "Data pengeluaran gagal dimuat." : null;

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-7"><Link href="/checkout" prefetch={false} aria-label="Kembali ke kasir" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-bold">Laporan usaha</h1><p className="text-sm text-muted">Ringkasan {range.label}.</p></div></div></header>
      <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-7">
        <nav aria-label="Periode laporan" className="flex gap-2 rounded-2xl border border-line bg-white p-2">{[{ id: "day", label: "Hari" }, { id: "week", label: "Minggu" }, { id: "month", label: "Bulan" }].map(({ id, label }) => <Link key={id} href={`/reports?period=${id}`} prefetch={false} aria-current={selectedPeriod === id ? "page" : undefined} className={`min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold ${selectedPeriod === id ? "bg-brand text-white" : "text-muted hover:bg-canvas"}`}>{label}</Link>)}</nav>
        {(salesErrorMessage || expensesErrorMessage) && <div role="alert" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{salesErrorMessage && <p>{salesErrorMessage}</p>}{expensesErrorMessage && <p>{expensesErrorMessage}</p>}</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Penjualan tercatat</p><span className="rounded-xl bg-brand-soft p-2 text-brand"><TrendingUp size={18} /></span></div><p className="mt-4 text-2xl font-bold">{money(revenue)}</p><p className="mt-1 text-xs text-muted">{saleList.length} transaksi tercatat</p></article>
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Pengeluaran</p><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><TrendingDown size={18} /></span></div><p className="mt-4 text-2xl font-bold">{money(expenseTotal)}</p><p className="mt-1 text-xs text-muted">{expenseList.length} catatan pengeluaran</p></article>
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><p className="text-sm text-muted">Laba bersih</p><span className="rounded-xl bg-canvas p-2 text-muted"><BarChart3 size={18} /></span></div><p className={`mt-4 text-2xl font-bold ${netProfit < 0 ? "text-red-700" : "text-ink"}`}>{itemsError ? "—" : money(netProfit)}</p><p className="mt-1 text-xs text-muted">Penjualan dikurangi HPP dan pengeluaran</p></article>
        </div>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={19} /></span><div><h2 className="font-semibold">Catatan laporan</h2><p className="text-sm text-muted">Periode {range.start} sampai {range.end}.</p></div></div><p className="text-sm leading-6 text-muted">Laba dihitung dari penjualan yang tersimpan dikurangi HPP saat transaksi dan pengeluaran tercatat. Pajak dan biaya pembayaran belum termasuk.</p><div className="flex flex-wrap gap-2"><Link href="/sales" prefetch={false} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-canvas">Lihat transaksi</Link><Link href="/expenses" prefetch={false} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-canvas">Lihat pengeluaran</Link><a href={`/reports/export?from=${range.start}&to=${range.end}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">Unduh CSV</a></div></section>
      </div>
      <MobileBottomNav />
    </main>
  );
}
