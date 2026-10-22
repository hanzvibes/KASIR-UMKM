import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./checkout-client";

type SearchParams = Promise<{ error?: string }>;

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

  const [{ data: products, error }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("kasir_products")
      .select("id, name, sku, category_id, unit, price, stock_qty, track_stock")
      .eq("business_id", membership.business_id)
      .eq("is_active", true)
      .order("name"),
    supabase.from("kasir_categories")
      .select("id, name")
      .eq("business_id", membership.business_id)
      .order("name"),
  ]);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-7">
          <Link href="/dashboard" aria-label="Buka ringkasan usaha" className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-bold">Kasir</h1><p className="text-sm text-muted">Pilih produk, cek keranjang, lalu simpan transaksi.</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-7">
        {(error || categoriesError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data produk atau kategori belum bisa dimuat. Pastikan migrasi awal sudah diterapkan di Supabase development.</p>}
        <CheckoutClient products={products ?? []} categories={categories ?? []} idempotencyKey={randomUUID()} errorMessage={params.error} dataError={Boolean(error || categoriesError)} />
      </div>
      <MobileBottomNav />
    </main>
  );
}
