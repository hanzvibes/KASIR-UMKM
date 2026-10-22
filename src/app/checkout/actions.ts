"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CartItem = { product_id: string; quantity: number };

function fail(message: string): never {
  redirect(`/checkout?error=${encodeURIComponent(message)}`);
}

export async function checkoutAction(formData: FormData) {
  const rawItems = formData.get("items");
  const idempotencyKey = formData.get("idempotency_key");
  const paymentMethod = formData.get("payment_method");

  if (typeof rawItems !== "string" || rawItems.length > 30000) fail("Keranjang tidak valid.");
  if (typeof idempotencyKey !== "string" || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) fail("Sesi checkout tidak valid. Muat ulang halaman.");
  if (paymentMethod !== "cash" && paymentMethod !== "transfer" && paymentMethod !== "other") fail("Metode pembayaran tidak valid.");

  let items: CartItem[];
  try {
    const parsed: unknown = JSON.parse(rawItems);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) fail("Keranjang harus berisi 1 sampai 100 baris produk.");
    items = parsed.map((item): CartItem => {
      if (!item || typeof item.product_id !== "string" || typeof item.quantity !== "number"
        || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000000) {
        fail("Produk atau jumlah barang tidak valid.");
      }
      return { product_id: item.product_id, quantity: item.quantity };
    });
  } catch {
    fail("Format keranjang tidak valid.");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership) redirect("/onboarding");

  const { data, error } = await supabase.rpc("create_sale", {
    p_business_id: membership.business_id,
    p_items: items,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    const message = error?.message ?? "";
    if (message.toLowerCase().includes("insufficient stock")) fail("Stok tidak cukup untuk salah satu produk. Periksa stok lalu coba lagi.");
    if (message.toLowerCase().includes("inactive") || message.toLowerCase().includes("product not found")) fail("Ada produk yang sudah nonaktif atau tidak tersedia.");
    if (message.toLowerCase().includes("business access denied")) redirect("/onboarding");
    fail("Transaksi gagal disimpan. Periksa keranjang dan coba lagi.");
  }

  revalidatePath("/");
  revalidatePath("/checkout");
  revalidatePath("/products");
  revalidatePath("/sales");
  redirect(`/sales/${data.id}`);
}
