import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { createExpense } from "./actions";

type SearchParams = Promise<{ error?: string; success?: string }>;
const money = (value: number | string | null) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

function todayJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
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

  const { data: expenses, error } = await supabase.from("kasir_expenses")
    .select("id, category, description, amount, expense_date, created_at")
    .eq("business_id", membership.business_id).order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(100);
  const canManage = membership.role === "owner";
  const total = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-7">
          <Link href="/" aria-label="Kembali ke dashboard" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-bold">Pengeluaran</h1><p className="text-sm text-muted">Catat biaya operasional usaha.</p></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 p-4 pb-24 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Wallet size={20} /></span><div><h2 className="font-semibold">Tambah pengeluaran</h2><p className="text-sm text-muted">Masukkan nominal dalam rupiah.</p></div></div>
          {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
          {params.success === "created" && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Pengeluaran berhasil dicatat.</p>}
          {canManage ? <form action={createExpense} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">Kategori *
              <select name="category" required defaultValue="" className="rounded-xl border border-line bg-white px-3 py-2.5 font-normal"><option value="" disabled>Pilih kategori</option><option>Bahan baku</option><option>Gaji</option><option>Sewa</option><option>Listrik & air</option><option>Transportasi</option><option>Marketing</option><option>Peralatan</option><option>Lainnya</option></select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">Nominal (Rp) *
              <input name="amount" type="number" min="1" step="1" required placeholder="50000" className="rounded-xl border border-line px-3 py-2.5 font-normal" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">Tanggal *
              <input name="expense_date" type="date" required defaultValue={todayJakarta()} className="rounded-xl border border-line px-3 py-2.5 font-normal" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">Catatan (opsional)
              <input name="description" maxLength={240} placeholder="Contoh: belanja susu dan gula" className="rounded-xl border border-line px-3 py-2.5 font-normal" />
            </label>
            <button className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-[#196640]">Simpan pengeluaran</button>
          </form> : <p className="text-sm text-muted">Akun kasir dapat melihat pengeluaran. Hanya pemilik usaha yang dapat mencatatnya.</p>}
        </section>
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line p-5"><p className="text-sm text-muted">Total dari 100 catatan terbaru</p><p className="mt-1 text-2xl font-bold">{money(total)}</p></div>
          {error ? <p role="alert" className="p-5 text-sm text-red-700">Data belum bisa dimuat. Pastikan migrasi pengeluaran diterapkan di Supabase development.</p> : (expenses ?? []).length === 0 ? <div className="p-8 text-center"><p className="font-semibold">Belum ada pengeluaran</p><p className="mt-1 text-sm text-muted">Catatan pengeluaran akan muncul di sini.</p></div> : <ul className="divide-y divide-line">{expenses?.map((expense) => <li key={expense.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{expense.category}</p><p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${expense.expense_date}T12:00:00+07:00`))}</p>{expense.description && <p className="mt-2 text-sm text-muted">{expense.description}</p>}</div><p className="shrink-0 text-sm font-bold">{money(expense.amount)}</p></div></li>)}</ul>}
        </section>
      </div>
      <MobileBottomNav />
    </main>
  );
}
