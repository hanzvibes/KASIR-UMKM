import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Banknote, CircleStop, Clock3 } from "lucide-react";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { addCashMovementAction, closeShiftAction, openShiftAction } from "./actions";
import PrintReportButton from "./print-report-button";

const rupiah = (value: number | string | null) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
type Params = Promise<{ error?: string; success?: string; closed?: string }>;

export default async function ShiftsPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: { user } }, { data: memberships }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (!user) redirect("/login");
  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");
  const { data: active } = await supabase.from("kasir_shifts").select("id, opened_at, opening_cash")
    .eq("business_id", membership.business_id).eq("cashier_id", user.id).eq("status", "open").maybeSingle();
  const [{ data: movements }, { data: summary }, { data: history }] = active ? await Promise.all([
    supabase.from("kasir_shift_cash_movements").select("movement_type, amount, reason, created_at").eq("shift_id", active.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("kasir_shift_summary", { p_shift_id: active.id }),
    Promise.resolve({ data: [] }),
  ]) : await Promise.all([
    Promise.resolve({ data: [] }), Promise.resolve({ data: null }),
    supabase.from("kasir_shifts").select("id, opened_at, closed_at, expected_cash, actual_cash, difference, status, cashier_id").eq("business_id", membership.business_id).order("opened_at", { ascending: false }).limit(membership.role === "owner" ? 30 : 0),
  ]);
  const paidCash = Number(summary?.cash_sales ?? 0);
  const cashIn = Number(summary?.cash_in ?? 0);
  const cashOut = Number(summary?.cash_out ?? 0);
  const expected = Number(summary?.expected_cash ?? active?.opening_cash ?? 0);
  const closedId = params.closed && /^[0-9a-f-]{36}$/i.test(params.closed) ? params.closed : null;
  const { data: closedShift } = !active && closedId ? await supabase.from("kasir_shifts").select("id,opened_at,closed_at,opening_cash,expected_cash,actual_cash,difference,note,cashier_id").eq("id", closedId).eq("business_id", membership.business_id).eq("status", "closed").maybeSingle() : { data: null };
  const { data: closedSummary } = closedShift ? await supabase.rpc("kasir_shift_summary", { p_shift_id: closedShift.id }) : { data: null };

  return <main className="min-h-screen bg-canvas pb-24">
    <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4"><Link href={active ? "/checkout" : "/dashboard"} aria-label="Kembali" className="grid h-10 w-10 place-items-center rounded-xl border border-line"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-bold">Buka / tutup kasir</h1><p className="text-sm text-muted">Catat uang awal dan cocokkan uang di laci.</p></div></div></header>
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7">
      {params.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {params.success && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{params.success === "closed" ? "Kasir ditutup. Laporan shift tersimpan." : "Catatan kas berhasil disimpan."}</p>}
      {!active ? <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Banknote /></span><div><h2 className="font-semibold">Mulai shift</h2><p className="text-sm text-muted">Hitung uang di laci sebelum mulai melayani.</p></div></div><form action={openShiftAction} className="space-y-4"><label className="grid gap-2 text-sm font-medium">Modal awal (Rp)<input name="opening_cash" required type="number" min="0" step="1" defaultValue="0" className="min-h-12 rounded-xl border border-line px-4 text-lg" /></label><button className="min-h-12 w-full rounded-xl bg-brand px-4 font-semibold text-white">Buka kasir</button></form></section> : <>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-green-50 text-green-700"><Clock3 /></span><div><h2 className="font-semibold">Shift sedang berjalan</h2><p className="text-sm text-muted">Dimulai {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(active.opened_at))}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm">{[["Modal awal", Number(active.opening_cash)], ["Penjualan tunai", paidCash], ["QRIS", Number(summary?.qris_sales ?? 0)], ["Transfer", Number(summary?.transfer_sales ?? 0)], ["Kas masuk", cashIn], ["Kas keluar", cashOut], ["Transaksi", Number(summary?.transaction_count ?? 0)], ["Void", Number(summary?.void_count ?? 0)], ["Perkiraan uang di laci", expected]].map(([label, amount]) => <div key={label} className="rounded-xl bg-canvas p-3"><p className="text-muted">{label}</p><strong className="mt-1 block">{typeof amount === "number" && label !== "Transaksi" && label !== "Void" ? rupiah(amount) : amount}</strong></div>)}</div></section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><h2 className="mb-4 font-semibold">Catat kas masuk / keluar</h2><form action={addCashMovementAction} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="shift_id" value={active.id} /><label className="grid gap-1 text-sm">Jenis<select name="movement_type" className="min-h-11 rounded-xl border border-line px-3"><option value="cash_in">Kas masuk</option><option value="cash_out">Kas keluar</option></select></label><label className="grid gap-1 text-sm">Nominal (Rp)<input name="amount" required type="number" min="1" step="1" className="min-h-11 rounded-xl border border-line px-3" /></label><label className="grid gap-1 text-sm sm:col-span-2">Alasan<input name="reason" required maxLength={240} placeholder="Contoh: beli kantong plastik" className="min-h-11 rounded-xl border border-line px-3" /></label><button className="min-h-11 rounded-xl border border-line font-semibold sm:col-span-2">Simpan catatan</button></form></section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="mb-2 font-semibold">Tutup shift</h2><p className="mb-4 text-sm text-amber-900">Hitung uang fisik. Perkiraan saat ini {rupiah(expected)}.</p><form action={closeShiftAction} className="space-y-3"><input type="hidden" name="shift_id" value={active.id} /><label className="grid gap-1 text-sm">Uang aktual di laci (Rp)<input name="actual_cash" required type="number" min="0" step="1" className="min-h-12 rounded-xl border border-amber-300 bg-white px-4 text-lg" /></label><label className="grid gap-1 text-sm">Catatan (opsional)<input name="note" maxLength={500} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3" /></label><button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 font-semibold text-white"><CircleStop size={17} /> Tutup shift</button></form></section>
        {!!movements?.length && <section className="rounded-2xl border border-line bg-white p-5"><h2 className="mb-3 font-semibold">Catatan kas shift ini</h2><div className="divide-y divide-line">{movements.map((movement, index) => <div key={index} className="flex justify-between gap-3 py-3 text-sm"><span>{movement.movement_type === "cash_in" ? "Kas masuk" : "Kas keluar"} · {movement.reason}</span><strong>{rupiah(movement.amount)}</strong></div>)}</div></section>}
      </>}
      {closedShift && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft print:mx-auto print:max-w-xl print:border-0 print:shadow-none"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Laporan penutupan shift</h2><p className="text-sm text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(closedShift.opened_at))}</p></div><PrintReportButton /></div><div className="divide-y divide-line">{[["Modal awal",closedShift.opening_cash],["Penjualan tunai",closedSummary?.cash_sales],["QRIS",closedSummary?.qris_sales],["Transfer",closedSummary?.transfer_sales],["Kas masuk",closedSummary?.cash_in],["Kas keluar",closedSummary?.cash_out],["Jumlah transaksi",closedSummary?.transaction_count],["Void",closedSummary?.void_count],["Uang seharusnya",closedShift.expected_cash],["Uang aktual",closedShift.actual_cash],["Selisih",closedShift.difference]].map(([label,value])=><div key={label} className="flex justify-between gap-3 py-2 text-sm"><span className="text-muted">{label}</span><strong>{label === "Jumlah transaksi" || label === "Void" ? Number(value ?? 0) : rupiah(Number(value ?? 0))}</strong></div>)}</div>{closedShift.note && <p className="mt-3 text-sm">Catatan: {closedShift.note}</p>}</section>}
      {!active && membership.role === "owner" && !!history?.length && <section className="rounded-2xl border border-line bg-white p-5"><h2 className="mb-3 font-semibold">Riwayat selisih kas</h2><div className="divide-y divide-line">{history.map((shift) => <div key={shift.id} className="flex justify-between gap-3 py-3 text-sm"><span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(shift.opened_at))} · {shift.status === "closed" ? "Ditutup" : "Berjalan"}</span><strong>{shift.difference === null ? "—" : rupiah(shift.difference)}</strong></div>)}</div></section>}
    </div><MobileBottomNav />
  </main>;
}
