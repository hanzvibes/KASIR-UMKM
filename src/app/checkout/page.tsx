import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Banknote, CheckCircle2, CircleStop, Clock3, ShoppingCart } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./checkout-client";
import ActivityPanel from "./activity-panel";
import CashMovementDialog from "./cash-movement-dialog";
import { closeShiftAction, openShiftAction } from "@/app/shifts/actions";
import PrintReportButton from "@/app/shifts/print-report-button";

type SearchParams = Promise<{ error?: string; success?: string; closed?: string }>;

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
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

  const { data: activeShift, error: shiftError } = await supabase.from("kasir_shifts")
    .select("id, opened_at, opening_cash").eq("business_id", membership.business_id)
    .eq("cashier_id", user.id).eq("status", "open").maybeSingle();
  const { data: business } = await supabase.from("kasir_businesses").select("name, qris_image_url").eq("id", membership.business_id).maybeSingle();
  if (shiftError) return <main className="grid min-h-screen place-items-center p-6"><p role="alert">Status kasir gagal dimuat. Muat ulang halaman.</p></main>;

  if (!activeShift) {
    return <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-7"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={18} /></span><div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold sm:text-lg">{business?.name ?? "Kasir"}</h1><p className="text-xs text-muted">Buka shift untuk mulai</p></div></div></header>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7">
        {params.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Banknote /></span><div><h2 className="font-semibold">Buka kasir</h2><p className="text-sm text-muted">Masukkan modal awal laci.</p></div></div><form action={openShiftAction} className="space-y-4"><label className="grid gap-2 text-sm font-medium">Modal awal (Rp)<input name="opening_cash" required type="number" min="0" step="1" defaultValue="0" className="min-h-12 rounded-xl border border-line px-4 text-lg" /></label><button className="min-h-12 w-full rounded-xl bg-brand px-4 font-semibold text-white">Mulai shift</button></form></section>
      </div>
    </main>;
  }

  const [{ data: products, error }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("kasir_products")
      .select("id, name, sku, category_id, unit, price, stock_qty, track_stock")
      .eq("business_id", membership.business_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase.from("kasir_categories")
      .select("id, name")
      .eq("business_id", membership.business_id)
      .order("name"),
  ]);
  const productIds = (products ?? []).map((product) => product.id);
  const { data: variantGroups, error: variantGroupsError } = productIds.length
    ? await supabase.from("kasir_product_variant_groups").select("id, product_id, name, required").eq("business_id", membership.business_id).in("product_id", productIds)
    : { data: [], error: null };
  const groupIds = (variantGroups ?? []).map((group) => group.id);
  const { data: variantOptions, error: variantOptionsError } = groupIds.length
    ? await supabase.from("kasir_product_variant_options").select("id, group_id, name, price_delta").eq("business_id", membership.business_id).in("group_id", groupIds).order("name")
    : { data: [], error: null };
  const variants = (variantGroups ?? []).map((group) => ({
    product_id: group.product_id,
    name: group.name,
    required: group.required,
    options: (variantOptions ?? []).filter((option) => option.group_id === group.id).map((option) => ({ id: option.id, name: option.name, price_delta: Number(option.price_delta) })),
  }));
  const [{ data: movements }, { data: summary }] = await Promise.all([
    supabase.from("kasir_shift_cash_movements").select("movement_type, amount, reason, created_at").eq("shift_id", activeShift.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("kasir_shift_summary", { p_shift_id: activeShift.id }),
  ]);
  const cashIn = Number(summary?.cash_in ?? 0);
  const cashOut = Number(summary?.cash_out ?? 0);
  const expectedCash = Number(summary?.expected_cash ?? activeShift.opening_cash ?? 0);
  const { data: completedSale } = params.success
    ? await supabase.from("kasir_sales").select("id, total_amount").eq("id", params.success).eq("business_id", membership.business_id).eq("status", "completed").maybeSingle()
    : { data: null };

  const closedId = params.closed && /^[0-9a-f-]{36}$/i.test(params.closed) ? params.closed : null;
  const { data: closedShift } = !closedId ? { data: null } : await supabase.from("kasir_shifts").select("id,opened_at,closed_at,opening_cash,expected_cash,actual_cash,difference,note,cashier_id").eq("id", closedId).eq("business_id", membership.business_id).eq("cashier_id", user.id).eq("status", "closed").maybeSingle();
  const { data: closedSummary } = closedShift ? await supabase.rpc("kasir_shift_summary", { p_shift_id: closedShift.id }) : { data: null };

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-7">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={18} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{business?.name ?? "Kasir"}</h1>
            <p className="mt-0.5 truncate text-xs text-muted sm:text-sm">
              Kasir · shift dibuka {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(activeShift.opened_at))}
            </p>
          </div>
          <ActivityPanel />
          <span className="hidden shrink-0 items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" /> Shift aktif
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-7">
        {(error || categoriesError || variantGroupsError || variantOptionsError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data produk, kategori, atau pilihan produk gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database.</p>}
        {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
        {params.success && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{params.success === "closed" ? "Shift ditutup." : "Catatan kas tersimpan."}</p>}
        <section className="rounded-2xl border border-line bg-white p-3 shadow-soft sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700"><Clock3 size={19} /></span>
            <div className="min-w-0 flex-1"><h2 className="font-semibold">Shift aktif</h2><p className="text-xs text-muted">Dibuka {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(activeShift.opened_at))}</p></div>
            <div className="min-w-0 text-right"><span className="block text-[11px] text-muted">Uang laci</span><strong className="block text-sm tabular-nums sm:text-base">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(expectedCash)}</strong></div>
            <CashMovementDialog shiftId={activeShift.id} />
          </div>
          <details className="mt-3 border-t border-line pt-2">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-muted">Rincian shift</summary>
            <div className="grid grid-cols-2 gap-2 pb-1 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-canvas p-3"><span className="text-xs text-muted">Modal awal</span><strong className="mt-1 block">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(activeShift.opening_cash))}</strong></div>
              <div className="rounded-xl bg-canvas p-3"><span className="text-xs text-muted">Kas masuk</span><strong className="mt-1 block">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(cashIn)}</strong></div>
              <div className="rounded-xl bg-canvas p-3"><span className="text-xs text-muted">Kas keluar</span><strong className="mt-1 block">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(cashOut)}</strong></div>
            </div>
          </details>
        </section>
        <details className="rounded-2xl border border-amber-200 bg-amber-50"><summary className="cursor-pointer px-5 py-4 font-semibold text-amber-950">Tutup shift</summary><div className="px-5 pb-5"><p className="mb-4 text-sm text-amber-900">Perkiraan uang laci: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(expectedCash)}.</p><form action={closeShiftAction} className="space-y-3"><input type="hidden" name="shift_id" value={activeShift.id} /><label className="grid gap-1 text-sm">Uang aktual (Rp)<input name="actual_cash" required type="number" min="0" step="1" className="min-h-12 rounded-xl border border-amber-300 bg-white px-4 text-lg" /></label><label className="grid gap-1 text-sm">Catatan<input name="note" maxLength={500} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3" /></label><button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 font-semibold text-white"><CircleStop size={17} /> Tutup shift</button></form></div></details>
        {!!movements?.length && <details className="rounded-2xl border border-line bg-white"><summary className="cursor-pointer px-5 py-4 font-semibold">Riwayat kas</summary><div className="divide-y divide-line px-5 pb-2">{movements.map((movement, index) => <div key={index} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{movement.movement_type === "cash_in" ? "Kas masuk" : "Kas keluar"} · {movement.reason}</span><strong>{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(movement.created_at))} · {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(movement.amount))}</strong></div>)}</div></details>}
        {closedShift && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft print:mx-auto print:max-w-xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Laporan penutupan kasir</h2><p className="text-sm text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(closedShift.opened_at))}</p></div><PrintReportButton /></div><div className="divide-y divide-line">{[["Modal awal",closedShift.opening_cash],["Penjualan tunai",closedSummary?.cash_sales],["QRIS",closedSummary?.qris_sales],["Transfer",closedSummary?.transfer_sales],["Uang masuk",closedSummary?.cash_in],["Uang keluar",closedSummary?.cash_out],["Jumlah transaksi",closedSummary?.transaction_count],["Void",closedSummary?.void_count],["Uang seharusnya",closedShift.expected_cash],["Uang aktual",closedShift.actual_cash],["Selisih",closedShift.difference]].map(([label,value])=><div key={label} className="flex justify-between gap-3 py-2 text-sm"><span className="text-muted">{label}</span><strong>{label === "Jumlah transaksi" || label === "Void" ? Number(value ?? 0) : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0))}</strong></div>)}</div>{closedShift.note && <p className="mt-3 text-sm">Catatan: {closedShift.note}</p>}</section>}
        {completedSale && <div role="status" className="animate-rise-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"><span className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Transaksi berhasil disimpan · {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(completedSale.total_amount))}</span><Link href={`/sales/${completedSale.id}`} className="font-semibold underline underline-offset-2">Lihat struk</Link></div>}
        <CheckoutClient key={completedSale?.id ?? "active-checkout"} products={products ?? []} categories={categories ?? []} variants={variants} businessId={membership.business_id} qrisImageUrl={business?.qris_image_url ?? null} idempotencyKey={randomUUID()} errorMessage={params.error} clearDraft={Boolean(completedSale)} successSaleId={completedSale?.id} dataError={Boolean(error || categoriesError || variantGroupsError || variantOptionsError)} />
      </div>

    </main>
  );
}
