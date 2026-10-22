"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function fail(message: string): never {
  redirect(`/checkout?error=${encodeURIComponent(message)}`);
}

export async function checkoutAction(formData: FormData) {
  const rawItems = formData.get("items");
  const idempotencyKey = formData.get("idempotency_key");
  const paymentMethod = formData.get("payment_method");
  const cashReceivedRaw = formData.get("cash_received");

  if (typeof rawItems !== "string" || rawItems.length > 30000) fail("Keranjang tidak valid.");
  if (typeof idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) fail("Sesi checkout tidak valid. Muat ulang halaman.");
  if (paymentMethod !== "cash" && paymentMethod !== "transfer" && paymentMethod !== "other") fail("Metode pembayaran tidak valid.");
  const cashReceived = paymentMethod === "cash" && typeof cashReceivedRaw === "string" && /^[0-9]+$/.test(cashReceivedRaw) ? Number(cashReceivedRaw) : null;
  if (paymentMethod === "cash" && (cashReceived === null || !Number.isSafeInteger(cashReceived) || cashReceived < 0)) fail("Nominal uang diterima harus berupa rupiah bulat nol atau lebih.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawItems);
  } catch {
    fail("Format keranjang tidak valid.");
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) fail("Keranjang harus berisi 1 sampai 100 baris produk.");

  const parsedItems = parsed.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("product_id" in item) || !("quantity" in item)
      || typeof item.product_id !== "string" || typeof item.quantity !== "number"
      || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000000) {
      fail("Produk atau jumlah barang tidak valid.");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.product_id)) {
      fail("ID produk tidak valid. Muat ulang halaman kasir.");
    }
    return { product_id: item.product_id, quantity: item.quantity };
  });

  // Merge repeated product IDs before calling the database so a crafted request
  // cannot bypass cart-level stock checks by splitting one product into lines.
  const quantities = new Map<string, number>();
  for (const item of parsedItems) {
    const quantity = (quantities.get(item.product_id) ?? 0) + item.quantity;
    if (!Number.isFinite(quantity) || quantity > 1000000) fail("Jumlah total produk tidak valid.");
    quantities.set(item.product_id, quantity);
  }
  const items = Array.from(quantities, ([product_id, quantity]) => ({ product_id, quantity }));

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
  const membership = memberships?.[0];
  if (membershipError || !membership) redirect("/onboarding");

  const { data, error } = await supabase.rpc("kasir_create_sale", {
    p_business_id: membership.business_id,
    p_items: items,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_cash_received: cashReceived,
  });

  if (error || !data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    const message = error?.message ?? "";
    if (message.toLowerCase().includes("insufficient stock")) fail("Stok tidak cukup untuk salah satu produk. Periksa stok lalu coba lagi.");
    if (message.toLowerCase().includes("cash received")) fail("Uang diterima tidak boleh kurang dari total transaksi.");
    if (message.toLowerCase().includes("inactive") || message.toLowerCase().includes("product not found")) fail("Ada produk yang sudah nonaktif atau tidak tersedia.");
    if (message.toLowerCase().includes("business access denied")) redirect("/onboarding");
    fail("Transaksi gagal disimpan. Pastikan migrasi checkout sudah diterapkan pada Supabase development.");
  }

  revalidatePath("/");
  revalidatePath("/checkout");
  revalidatePath("/products");
  revalidatePath("/sales");
  redirect(`/sales/${data.id}`);
}
