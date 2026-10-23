import { randomUUID } from "node:crypto";
import { Banknote, CheckCircle2, ShoppingCart } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./checkout-client";
import SaleComplete from "./sale-complete";
import CashierMenu from "./cashier-menu";
import { openShiftAction } from "@/app/shifts/actions";
import PrintReportButton from "@/app/shifts/print-report-button";

type SearchParams = Promise<{ error?: string; success?: string; closed?: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rupiah = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

const jakartaTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));

const jakartaDateTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));

type ClosedShift = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number | string;
  expected_cash: number | string | null;
  actual_cash: number | string | null;
  difference: number | string | null;
  note: string | null;
};

type ShiftSummary = {
  cash_sales?: number | string | null;
  qris_sales?: number | string | null;
  transfer_sales?: number | string | null;
  cash_in?: number | string | null;
  cash_out?: number | string | null;
  transaction_count?: number | string | null;
  void_count?: number | string | null;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  unit: string;
  price: number;
  stock_qty: number | null;
  track_stock: boolean;
};

type VariantGroupRow = { id: string; product_id: string; name: string; required: boolean };
type VariantOptionRow = { id: string; group_id: string; name: string; price_delta: number };

function ClosedShiftReport({ shift, summary }: { shift: ClosedShift; summary: ShiftSummary | null }) {
  const rows: [string, number | string | null][] = [
    ["Modal awal", shift.opening_cash],
    ["Penjualan tunai", summary?.cash_sales ?? null],
    ["QRIS", summary?.qris_sales ?? null],
    ["Transfer", summary?.transfer_sales ?? null],
    ["Uang masuk", summary?.cash_in ?? null],
    ["Uang keluar", summary?.cash_out ?? null],
    ["Jumlah transaksi", summary?.transaction_count ?? null],
    ["Void", summary?.void_count ?? null],
    ["Uang seharusnya", shift.expected_cash],
    ["Uang aktual", shift.actual_cash],
    ["Selisih", shift.difference],
  ];
  return (
    <section data-print-report className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Laporan penutupan kasir</h2>
          <p className="text-sm text-muted">Buka {jakartaDateTime(shift.opened_at)}</p>
          {shift.closed_at && <p className="text-sm text-muted">Tutup {jakartaDateTime(shift.closed_at)}</p>}
        </div>
        <PrintReportButton />
      </div>
      <div className="divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-2 text-sm">
            <span className="text-muted">{label}</span>
            <strong className={label === "Selisih" && Number(value ?? 0) !== 0 ? "text-amber-800" : undefined}>
              {label === "Jumlah transaksi" || label === "Void" ? Number(value ?? 0) : rupiah(value)}
            </strong>
          </div>
        ))}
      </div>
      {shift.note && <p className="mt-3 text-sm">Catatan: {shift.note}</p>}
    </section>
  );
}

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

  const successSaleId = params.success && UUID_PATTERN.test(params.success) ? params.success : null;
  const closedId = params.closed && UUID_PATTERN.test(params.closed) ? params.closed : null;

  // Shift, business identity, and a just-completed sale are independent reads.
  const [shiftResult, businessResult, completedSaleResult] = await Promise.all([
    supabase.from("kasir_shifts")
      .select("id, opened_at, opening_cash").eq("business_id", membership.business_id)
      .eq("cashier_id", user.id).eq("status", "open").maybeSingle(),
    supabase.from("kasir_businesses").select("name, qris_image_url").eq("id", membership.business_id).maybeSingle(),
    successSaleId
      ? supabase.from("kasir_sales")
        .select("id, invoice_no, payment_method, total_amount, cash_received, change_due")
        .eq("id", successSaleId).eq("business_id", membership.business_id).eq("status", "completed").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const activeShift = shiftResult.data;
  const business = businessResult.data;
  const completedSale = completedSaleResult.data;
  if (shiftResult.error) {
    return <main className="grid min-h-screen place-items-center p-6"><p role="alert">Status kasir gagal dimuat. Muat ulang halaman.</p></main>;
  }

  if (!activeShift) {
    // The closing report is shown after the shift closes; previously this screen
    // returned before it could render, so the cashier lost access to it.
    const { data: closedShift } = closedId
      ? await supabase.from("kasir_shifts")
        .select("id, opened_at, closed_at, opening_cash, expected_cash, actual_cash, difference, note")
        .eq("id", closedId).eq("business_id", membership.business_id).eq("cashier_id", user.id).eq("status", "closed").maybeSingle()
      : { data: null };
    const { data: closedSummary } = closedShift
      ? await supabase.rpc("kasir_shift_summary", { p_shift_id: closedShift.id })
      : { data: null };

    return (
      <main className="min-h-screen bg-canvas pb-24 md:pb-28">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-7">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={18} /></span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold sm:text-lg">{business?.name ?? "Kasir"}</h1>
              <p className="text-xs text-muted">{closedShift ? "Shift ditutup" : "Buka shift untuk mulai"}</p>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7">
          {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
          {params.success === "closed" && (
            <p role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 size={18} aria-hidden="true" /> Shift ditutup. Laporan tersimpan.
            </p>
          )}
          {closedShift && <ClosedShiftReport shift={closedShift} summary={closedSummary} />}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Banknote /></span>
              <div><h2 className="font-semibold">Buka kasir</h2><p className="text-sm text-muted">Masukkan modal awal laci.</p></div>
            </div>
            <form action={openShiftAction} className="space-y-4">
              <label className="grid gap-2 text-sm font-medium">Modal awal (Rp)
                <input name="opening_cash" required type="number" min="0" step="1" defaultValue="0" className="min-h-12 rounded-xl border border-line px-4 text-lg" />
              </label>
              <button className="min-h-12 w-full rounded-xl bg-brand px-4 font-semibold text-white">Mulai shift</button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (completedSale) {
    return (
      <main className="min-h-screen bg-canvas pb-24 md:pb-28">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-7">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={17} /></span>
            <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold leading-tight sm:text-base">{business?.name ?? "Kasir"}</h1></div>
            <span className="hidden shrink-0 text-xs text-muted sm:inline">Shift · {jakartaTime(activeShift.opened_at)}</span>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-7">
          <SaleComplete sale={completedSale} businessId={membership.business_id} />
        </div>
      </main>
    );
  }

  // Products, categories, and the cash drawer summary do not depend on each other.
  const [productsResult, categoriesResult, movementsResult, summaryResult] = await Promise.all([
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
    supabase.from("kasir_shift_cash_movements").select("movement_type, amount, reason, created_at").eq("shift_id", activeShift.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("kasir_shift_summary", { p_shift_id: activeShift.id }),
  ]);
  const products = productsResult.data;
  const error = productsResult.error;
  const categories = categoriesResult.data;
  const categoriesError = categoriesResult.error;
  const movements = movementsResult.data;
  const summary = summaryResult.data;

  // Variant groups and their options are fetched together; options are matched to
  // the active products locally instead of waiting for a second round trip.
  const productIds = ((products ?? []) as ProductRow[]).map((product) => product.id);
  let variantGroups: VariantGroupRow[] = [];
  let variantOptions: VariantOptionRow[] = [];
  let variantGroupsError: { message: string } | null = null;
  let variantOptionsError: { message: string } | null = null;
  if (productIds.length) {
    const [groupsResult, optionsResult] = await Promise.all([
      supabase.from("kasir_product_variant_groups")
        .select("id, product_id, name, required").eq("business_id", membership.business_id).in("product_id", productIds),
      supabase.from("kasir_product_variant_options")
        .select("id, group_id, name, price_delta").eq("business_id", membership.business_id).order("name"),
    ]);
    variantGroups = (groupsResult.data ?? []) as VariantGroupRow[];
    variantOptions = (optionsResult.data ?? []) as VariantOptionRow[];
    variantGroupsError = groupsResult.error;
    variantOptionsError = optionsResult.error;
  }

  const variants = variantGroups.map((group) => ({
    product_id: group.product_id,
    name: group.name,
    required: group.required,
    options: variantOptions
      .filter((option) => option.group_id === group.id)
      .map((option) => ({ id: option.id, name: option.name, price_delta: Number(option.price_delta) })),
  }));

  const cashIn = Number(summary?.cash_in ?? 0);
  const cashOut = Number(summary?.cash_out ?? 0);
  const expectedCash = Number(summary?.expected_cash ?? activeShift.opening_cash ?? 0);
  const dataError = Boolean(error || categoriesError || variantGroupsError || variantOptionsError);

  return (
    <main className="min-h-screen bg-canvas pb-24 sm:pb-36 md:pb-44 xl:pb-12">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-7">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={17} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold leading-tight sm:text-base">{business?.name ?? "Kasir"}</h1>
          </div>
          <span className="hidden shrink-0 text-xs text-muted sm:inline">Shift · {jakartaTime(activeShift.opened_at)}</span>
          <CashierMenu shiftId={activeShift.id} openingCash={Number(activeShift.opening_cash)} expectedCash={expectedCash} cashIn={cashIn} cashOut={cashOut} movements={movements ?? []} />
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-7">
        {dataError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data produk, kategori, atau pilihan produk gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database.</p>}
        {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
        {params.success === "movement" && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Catatan kas tersimpan.</p>}
        <CheckoutClient
          products={(products ?? []) as ProductRow[]}
          categories={categories ?? []}
          variants={variants}
          businessId={membership.business_id}
          qrisImageUrl={business?.qris_image_url ?? null}
          idempotencyKey={randomUUID()}
          errorMessage={params.error}
          dataError={dataError}
        />
      </div>
    </main>
  );
}
