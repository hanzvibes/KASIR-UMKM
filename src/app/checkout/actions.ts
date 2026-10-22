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
  const discountRaw = formData.get("discount");

  if (typeof rawItems !== "string" || rawItems.length > 30000) fail("Keranjang tidak valid.");
  if (typeof idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) fail("Sesi checkout tidak valid. Muat ulang halaman.");
  if (paymentMethod !== "cash" && paymentMethod !== "transfer" && paymentMethod !== "qris") fail("Metode pembayaran tidak valid.");
  if (typeof discountRaw !== "string" || !/^\d+$/.test(discountRaw)) fail("Nominal diskon tidak valid.");
  const discount = Number(discountRaw);
  if (!Number.isSafeInteger(discount) || discount < 0) fail("Diskon harus berupa rupiah bulat nol atau lebih.");
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
    let variantOptionId: string | null = null;
    if ("variant_option_id" in item && item.variant_option_id !== null && item.variant_option_id !== "") {
      if (typeof item.variant_option_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.variant_option_id)) {
        fail("Pilihan produk tidak valid. Muat ulang halaman kasir.");
      }
      variantOptionId = item.variant_option_id;
    }
    return { product_id: item.product_id, quantity: item.quantity, variant_option_id: variantOptionId };
  });

  // Merge repeated product and option pairs so split lines cannot bypass cart validation.
  const quantities = new Map<string, number>();
  for (const item of parsedItems) {
    const key = `${item.product_id}:${item.variant_option_id ?? ""}`;
    const quantity = (quantities.get(key) ?? 0) + item.quantity;
    if (!Number.isFinite(quantity) || quantity > 1000000) fail("Jumlah total produk tidak valid.");
    quantities.set(key, quantity);
  }
  const items = Array.from(quantities, ([key, quantity]) => {
    const [product_id, variant_option_id] = key.split(":");
    return { product_id, quantity, variant_option_id: variant_option_id || null };
  });

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

  const { data, error } = await supabase.rpc("kasir_create_sale", {
    p_business_id: membership.business_id,
    p_items: items,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_cash_received: cashReceived,
    p_discount: discount,
  });

  if (error || !data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    const message = error?.message ?? "";
    if (message.toLowerCase().includes("insufficient stock")) fail("Stok tidak cukup untuk salah satu produk. Periksa stok lalu coba lagi.");
    if (message.toLowerCase().includes("cash received")) fail("Uang diterima tidak boleh kurang dari total transaksi.");
    if (message.toLowerCase().includes("inactive") || message.toLowerCase().includes("product not found")) fail("Ada produk yang sudah nonaktif atau tidak tersedia.");
    if (message.toLowerCase().includes("variant")) fail("Pilihan produk berubah atau tidak tersedia. Periksa kembali keranjang.");
    if (message.toLowerCase().includes("business access denied")) redirect("/onboarding");
    fail("Transaksi gagal disimpan. Pastikan migrasi checkout sudah diterapkan pada Supabase development.");
  }

  revalidatePath("/");
  revalidatePath("/checkout");
  revalidatePath("/products");
  revalidatePath("/sales");
  // Keep the cashier on the selling screen so they can start the next order immediately.
  redirect(`/checkout?success=${encodeURIComponent(data.id)}`);
}
