import Link from "next/link";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowDownRight, ArrowUpRight, Boxes, BarChart3, CircleDollarSign, ClipboardList, CreditCard, LayoutDashboard, Package, Plus, ReceiptText, ShoppingCart, Wallet } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Kasir", icon: ShoppingCart },
  { label: "Transaksi", icon: ReceiptText },
  { label: "Produk", icon: Package },
  { label: "Pengeluaran", icon: Wallet },
  { label: "Laporan", icon: BarChart3 },
];

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function HomePage() {
  const supabase = await createClient();
  const [
    { data: { user }, error: authError },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (authError || !user) redirect("/login");
  if (membershipError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
          <h1 className="text-xl font-bold">Usaha belum bisa dimuat</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Akunmu sudah masuk, tetapi data keanggotaan usaha gagal dibaca. Kami tidak akan mengarahkanmu untuk membuat usaha baru atau mengubah data yang ada.</p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">Periksa koneksi database dan hak akses membership. Data usaha tidak dihapus, dan kamu tidak perlu membuat profil baru.</p>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">Coba lagi</Link>
        </section>
      </main>
    );
  }
  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");

  const today = jakartaToday();
  const start = new Date(`${today}T00:00:00+07:00`);
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const from = start.toISOString();
  const to = next.toISOString();
  const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }, { data: recentSales }] = await Promise.all([
    supabase.from("kasir_sales").select("id, total_amount, payment_method, created_at")
      .eq("business_id", membership.business_id).eq("status", "completed").gte("created_at", from).lt("created_at", to),
    supabase.from("kasir_expenses").select("amount, expense_date")
      .eq("business_id", membership.business_id).eq("expense_date", today),
    supabase.from("kasir_sales").select("id, total_amount, payment_method, created_at")
      .eq("business_id", membership.business_id).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
  ]);

  const saleList = sales ?? [];
  const expenseList = expenses ?? [];
  const revenue = saleList.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const expenseTotal = expenseList.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const stats = [
    { label: "Penjualan hari ini", value: salesError ? "—" : money(revenue), detail: salesError ? "Data belum bisa dimuat" : saleList.length ? `${saleList.length} transaksi tercatat` : "Belum ada transaksi", icon: CircleDollarSign },
    { label: "Transaksi", value: salesError ? "—" : String(saleList.length), detail: "Hari ini", icon: ReceiptText },
    { label: "Estimasi laba kotor", value: "—", detail: "HPP belum tersedia pada data transaksi", icon: ArrowUpRight },
    { label: "Pengeluaran", value: expensesError ? "—" : money(expenseTotal), detail: expensesError ? "Data belum bisa dimuat" : `${expenseList.length} catatan hari ini`, icon: ArrowDownRight },
  ];
  const todayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date());
  return (
    <main className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white p-5 md:flex md:flex-col">
        <Link href="/dashboard" className="mb-9 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={21} /></span>
          <span><strong className="block text-base">Kasir UMKM</strong><small className="text-muted">Teman usaha harian</small></span>
        </Link>
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted">Menu utama</p>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <Link key={label} href={label === "Produk" ? "/products" : label === "Kasir" ? "/checkout" : label === "Transaksi" ? "/sales" : label === "Pengeluaran" ? "/expenses" : label === "Laporan" ? "/reports" : label === "Dashboard" ? "/dashboard" : "#"} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"}`}>
              <Icon size={18} strokeWidth={1.8} />{label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3 md:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={19} /></span>
            <strong>Kasir UMKM</strong>
          </div>
          <div className="hidden md:block">
            <p className="text-sm text-muted">Selamat datang</p>
            <h1 className="text-lg font-semibold">Ringkasan usaha</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand sm:inline-flex">{membership.role === "owner" ? "Pemilik usaha" : "Tim kasir"}</span>
            <div aria-label={user.email ?? "Akun pengguna"} title={user.email ?? "Akun pengguna"} className="grid h-9 w-9 place-items-center rounded-full bg-[#e8eee9] text-sm font-semibold uppercase">{user.email?.trim().charAt(0) || "U"}</div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 pb-24 sm:p-7 md:pb-8">
          <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-[#dce9df] bg-[linear-gradient(135deg,#ffffff_0%,#f0f7f1_100%)] p-5 shadow-soft sm:flex-row sm:items-end sm:p-7">
            <div>
              <p className="mb-1 text-sm text-muted capitalize">{todayLabel}</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h2>
              <p className="mt-2 text-sm text-muted">Pantau penjualan dan aktivitas usahamu.</p>
            </div>
            <Link href="/checkout" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-[#196640]">
              <Plus size={17} /> Mulai transaksi
            </Link>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map(({ label, value, detail, icon: Icon }, index) => (
              <article key={label} className={`rounded-2xl border p-4 shadow-soft sm:p-5 ${index === 0 ? "border-[#cfe4d4] bg-[#f1f8f2]" : "border-line bg-white"}`}>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-5 text-muted sm:text-sm">{label}</p>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-white text-brand" : "bg-canvas text-brand"}`}><Icon size={18} /></span>
                </div>
                <p className="text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
                <p className="mt-2 text-xs text-muted">{detail}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <article className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div><h3 className="font-semibold">Aktivitas penjualan</h3><p className="mt-1 text-sm text-muted">Ringkasan transaksi terbaru</p></div>
                <span className="rounded-lg bg-canvas p-2 text-muted"><ClipboardList size={18} /></span>
              </div>
              {salesError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Data penjualan belum bisa dimuat. Coba muat ulang halaman.</p> : (recentSales ?? []).length === 0 ? <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-line px-5 py-8 text-center"><div className="max-w-xs"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><BarChart3 size={23} /></span><p className="font-semibold">Belum ada data penjualan</p><p className="mt-1 text-sm leading-6 text-muted">Transaksi yang kamu catat nanti akan muncul di sini.</p></div></div> : <div className="divide-y divide-line">{recentSales?.map((sale) => <Link key={sale.id} href={`/sales/${sale.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><ReceiptText size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Struk #{sale.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at))} · {sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "Lainnya"}</span></span><strong className="shrink-0 text-sm">{money(Number(sale.total_amount))}</strong></Link>)}</div>}
            </article>

            <article className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div><h3 className="font-semibold">Mulai dari sini</h3><p className="mt-1 text-sm text-muted">Siapkan kasir dalam beberapa langkah</p></div>
                <span className="rounded-lg bg-canvas p-2 text-muted"><Boxes size={18} /></span>
              </div>
              <div className="space-y-3">
                {[
                  { title: "Tambah produk", desc: "Siapkan barang dan harga jual", icon: Package, href: "/products" },
                  { title: "Transaksi baru", desc: "Mulai melayani pelanggan", icon: CreditCard, href: "/checkout" },
                  { title: "Catat pengeluaran", desc: "Jaga biaya operasional tetap tercatat", icon: Wallet, href: "/expenses" },
                ].map(({ title, desc, icon: Icon, href }) => (
                  <Link key={title} href={href} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-brand hover:bg-brand-soft/30 active:scale-[0.99]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-brand"><Icon size={19} /></span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted">{desc}</p></div>
                    <Plus size={16} className="shrink-0 text-muted" />
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </div>

        <MobileBottomNav />

      </section>
    </main>
  );
}
