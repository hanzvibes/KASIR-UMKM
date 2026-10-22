import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./checkout-client";

type SearchParams = Promise<{ error?: string; success?: string }>;

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
  if (shiftError) return <main className="grid min-h-screen place-items-center p-6"><p role="alert">Status kasir gagal dimuat. Muat ulang halaman.</p></main>;
  if (!activeShift) redirect("/shifts");

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
  const { data: business } = await supabase.from("kasir_businesses").select("qris_image_url").eq("id", membership.business_id).maybeSingle();
  const { data: completedSale } = params.success
    ? await supabase.from("kasir_sales").select("id, total_amount").eq("id", params.success).eq("business_id", membership.business_id).eq("status", "completed").maybeSingle()
    : { data: null };

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-7">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><ShoppingCart size={18} /></span>
          <div><h1 className="text-lg font-bold">Kasir</h1><p className="text-sm text-muted">Ketuk produk untuk mulai transaksi.</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-7">
        {(error || categoriesError || variantGroupsError || variantOptionsError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data produk, kategori, atau pilihan produk gagal dimuat. Muat ulang halaman; jika tetap gagal, periksa koneksi database.</p>}
        {completedSale && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"><span className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Transaksi berhasil disimpan · {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(completedSale.total_amount))}</span><Link href={`/sales/${completedSale.id}`} className="font-semibold underline underline-offset-2">Lihat struk</Link></div>}
        <CheckoutClient key={completedSale?.id ?? "active-checkout"} products={products ?? []} categories={categories ?? []} variants={variants} businessId={membership.business_id} qrisImageUrl={business?.qris_image_url ?? null} idempotencyKey={randomUUID()} errorMessage={params.error} clearDraft={Boolean(completedSale)} successSaleId={completedSale?.id} dataError={Boolean(error || categoriesError || variantGroupsError || variantOptionsError)} />
      </div>

    </main>
  );
}
