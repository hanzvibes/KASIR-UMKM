import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Download, ReceiptText, ShoppingBag, TrendingDown, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";

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
  if (period === "day") return { period, start: today, end: today, label: "Hari ini" };
  if (period === "week") {
    const todayDate = new Date(`${today}T12:00:00+07:00`);
    const weekday = (todayDate.getUTCDay() + 6) % 7;
    const monday = new Date(todayDate.getTime() - weekday * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    return { period, start: jakartaDate(monday), end: jakartaDate(sunday), label: "Minggu ini" };
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
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (authError || !user) redirect("/login");
  const membership = memberships?.[0];
  if (membershipError || !membership) redirect("/onboarding");

  const params = await searchParams;
  const selectedPeriod = ["day", "week", "month"].includes(params.period ?? "") ? params.period! : "month";
  const range = periodRange(selectedPeriod);
  const from = `${range.start}T00:00:00+07:00`;
  const to = new Date(new Date(`${range.end}T00:00:00+07:00`).getTime() + 86400000).toISOString();
  const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("kasir_sales").select("id, total_amount, payment_method, created_at").eq("business_id", membership.business_id).eq("status", "completed").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }).range(0, 4999),
    supabase.from("kasir_expenses").select("amount, expense_date").eq("business_id", membership.business_id).gte("expense_date", range.start).lte("expense_date", range.end).range(0, 4999),
  ]);

  const saleList = sales ?? [];
  const expenseList = expenses ?? [];
  const revenue = saleList.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const expenseTotal = expenseList.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const { data: saleItems, error: itemsError } = saleList.length
    ? await supabase.from("kasir_sale_items").select("product_name, unit_cost, quantity, line_total").eq("business_id", membership.business_id).in("sale_id", saleList.map((sale) => sale.id)).range(0, 9999)
    : { data: [], error: null };
  const reportIncomplete = Boolean(salesError || expensesError || itemsError);
  const cogs = (saleItems ?? []).reduce((sum, item) => sum + Number(item.unit_cost ?? 0) * Number(item.quantity), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;

  const bestSellerMap = new Map<string, { quantity: number; revenue: number }>();
  for (const item of saleItems ?? []) {
    const current = bestSellerMap.get(item.product_name) ?? { quantity: 0, revenue: 0 };
    bestSellerMap.set(item.product_name, {
      quantity: current.quantity + Number(item.quantity),
      revenue: current.revenue + Number(item.line_total ?? 0),
    });
  }
  const bestSellers = [...bestSellerMap].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5);
  const recentSales = saleList.slice(0, 5);
  const periodQuery = (period: string) => `/reports?period=${period}`;

  const cards = [
    { label: "Penjualan", value: salesError ? "—" : money(revenue), detail: salesError ? "Gagal dimuat" : `${saleList.length} transaksi`, icon: ArrowUpRight },
    { label: "Pengeluaran", value: expensesError ? "—" : money(expenseTotal), detail: expensesError ? "Gagal dimuat" : `${expenseList.length} catatan`, icon: TrendingDown },
    { label: "Laba kotor", value: itemsError || salesError ? "—" : money(grossProfit), detail: itemsError || salesError ? "Rincian transaksi belum lengkap" : "Penjualan − HPP", icon: ShoppingBag },
    { label: "Laba bersih", value: itemsError || salesError || expensesError ? "—" : money(netProfit), detail: "Setelah pengeluaran", icon: Wallet },
  ];

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <PageHeader title="Laporan" subtitle={`${range.label} · ${range.start} sampai ${range.end}`} />

      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-7">
        <nav aria-label="Periode laporan" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white p-1.5">
          {[{ id: "day", label: "Hari ini" }, { id: "week", label: "Minggu ini" }, { id: "month", label: "Bulan ini" }].map(({ id, label }) => (
            <Link
              key={id}
              href={periodQuery(id)}
              prefetch={true}
              aria-current={selectedPeriod === id ? "page" : undefined}
              className={`min-h-11 rounded-xl px-2 py-2.5 text-center text-sm font-semibold transition-colors ${selectedPeriod === id ? "bg-brand text-white" : "text-muted hover:bg-canvas"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {reportIncomplete && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p><strong>Laporan belum lengkap.</strong> Beberapa angka laba disembunyikan agar tidak menyesatkan. Coba muat ulang untuk mengambil data terbaru.</p>
            <Link href={periodQuery(selectedPeriod)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 font-semibold hover:bg-amber-100">Coba lagi</Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, detail, icon: Icon }, index) => (
            <article key={label} className={`rounded-2xl border p-4 shadow-soft sm:p-5 ${index === 3 ? "border-[#cfe4d4] bg-[#f1f8f2]" : "border-line bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-5 text-muted sm:text-sm">{label}</p>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-brand"><Icon size={16} /></span>
              </div>
              <p className="mt-3 break-words text-lg font-bold tracking-tight tabular-nums sm:text-xl">{value}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted sm:text-xs">{detail}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Produk terlaris</h2>
              <span className="text-xs text-muted">{range.label}</span>
            </div>
            {itemsError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Ringkasan produk gagal dimuat.</p>
            ) : bestSellers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand"><ShoppingBag size={20} /></span><p className="mt-3 text-sm font-semibold">Belum ada produk terjual</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">Penjualan produk pada periode {range.label.toLowerCase()} akan muncul di sini.</p><Link href="/checkout" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-xs font-semibold text-white hover:bg-[#196640]">Mulai transaksi</Link></div>
            ) : (
              <ol className="divide-y divide-line">
                {bestSellers.map(([name, summary], index) => (
                  <li key={name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                    <span className="shrink-0 text-right">
                      <strong className="block text-sm tabular-nums">{summary.quantity} terjual</strong>
                      <span className="text-[11px] text-muted">{money(summary.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Transaksi terakhir</h2>
              <Link href="/sales" prefetch={true} className="text-xs font-semibold text-brand hover:underline">Lihat semua</Link>
            </div>
            {salesError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Data penjualan gagal dimuat.</p>
            ) : recentSales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand"><ReceiptText size={20} /></span><p className="mt-3 text-sm font-semibold">Belum ada transaksi</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">Transaksi pada periode {range.label.toLowerCase()} akan tercatat di sini.</p><Link href="/checkout" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-xs font-semibold text-white hover:bg-[#196640]">Buka kasir</Link></div>
            ) : (
              <ul className="divide-y divide-line">
                {recentSales.map((sale) => (
                  <li key={sale.id}>
                    <Link href={`/sales/${sale.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">Struk #{sale.id.slice(0, 8).toUpperCase()}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(sale.created_at))} · {sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "QRIS"}
                        </span>
                      </span>
                      <strong className="shrink-0 text-sm tabular-nums">{money(Number(sale.total_amount))}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <h2 className="font-semibold">Unduh & catatan</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Laba dihitung dari penjualan tersimpan dikurangi HPP saat transaksi dan pengeluaran tercatat. Pajak dan biaya pembayaran belum termasuk.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/reports/export?from=${range.start}&to=${range.end}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-[#196640]"
            >
              <Download size={16} /> Unduh CSV
            </a>
            <Link href="/expenses" prefetch={true} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-canvas">
              Catat pengeluaran
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
