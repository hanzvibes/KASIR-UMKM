"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nonNegativeNumber(value: string) {
  if (!value || !/^\d+(\.\d{1,3})?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function getBusinessContext() {
  const supabase = await createClient();
  const [
    { data: { user }, error: authError },
    { data: memberships, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (authError || !user) redirect("/login");
  const membership = memberships?.[0];

  if (error || !membership) redirect("/onboarding");
  if (membership.role !== "owner") redirect("/products?error=owner_only");
  return { supabase, businessId: membership.business_id };
}

function fail(message: string): never {
  redirect(`/products?error=${encodeURIComponent(message)}`);
}

export async function createCategory(formData: FormData) {
  const name = textValue(formData, "name");
  if (!name || name.length > 80) fail("Nama kategori wajib diisi (maksimal 80 karakter).");

  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_categories").insert({ business_id: businessId, name });
  if (error) {
    if (error.code === "23505") fail("Kategori dengan nama itu sudah ada.");
    fail("Kategori gagal disimpan. Periksa koneksi dan coba lagi.");
  }
  revalidatePath("/products");
  redirect("/products?success=category_created");
}

export async function updateCategory(formData: FormData) {
  const id = textValue(formData, "id");
  const name = textValue(formData, "name");
  if (!id || !name || name.length > 80) fail("Nama kategori wajib diisi (maksimal 80 karakter).");

  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_categories").update({ name }).eq("id", id).eq("business_id", businessId);
  if (error) {
    if (error.code === "23505") fail("Kategori dengan nama itu sudah ada.");
    fail("Kategori gagal diperbarui.");
  }
  revalidatePath("/products");
  redirect("/products?success=category_updated");
}

export async function deleteCategory(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) fail("Kategori tidak valid.");

  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_categories").delete().eq("id", id).eq("business_id", businessId);
  if (error) {
    if (error.code === "23503") fail("Kategori masih dipakai produk. Pindahkan produk ke kategori lain terlebih dahulu.");
    fail("Kategori gagal dihapus.");
  }
  revalidatePath("/products");
  redirect("/products?success=category_deleted");
}

function readProduct(formData: FormData) {
  const name = textValue(formData, "name");
  const sku = textValue(formData, "sku");
  const categoryId = textValue(formData, "category_id");
  const unit = textValue(formData, "unit") || "pcs";
  const price = nonNegativeNumber(textValue(formData, "price"));
  const costRaw = textValue(formData, "cost_price");
  const costPrice = costRaw ? nonNegativeNumber(costRaw) : null;
  const stockRaw = textValue(formData, "stock_qty");
  const stockQty = stockRaw ? nonNegativeNumber(stockRaw) : null;
  const trackStock = textValue(formData, "track_stock") === "on";

  if (!name || name.length > 160) fail("Nama produk wajib diisi (maksimal 160 karakter).");
  if (sku.length > 80) fail("SKU maksimal 80 karakter.");
  if (unit.length > 24) fail("Satuan maksimal 24 karakter.");
  if (price === null || !Number.isInteger(price)) fail("Harga jual harus bilangan bulat nol atau lebih.");
  if (costRaw && (costPrice === null || !Number.isInteger(costPrice))) fail("Harga modal harus bilangan bulat nol atau lebih.");
  if (stockRaw && stockQty === null) fail("Stok harus angka nol atau lebih.");
  if (trackStock && stockQty === null) fail("Isi jumlah stok jika pelacakan stok diaktifkan.");

  return {
    name, sku: sku || null, category_id: categoryId || null, unit, price,
    cost_price: costPrice, stock_qty: trackStock ? stockQty : null, track_stock: trackStock,
  };
}

export async function createProduct(formData: FormData) {
  const product = readProduct(formData);
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_products").insert({ ...product, business_id: businessId });
  if (error) {
    if (error.code === "23505") fail("SKU tersebut sudah digunakan produk lain.");
    if (error.code === "23503") fail("Kategori yang dipilih tidak valid.");
    fail("Produk gagal disimpan. Periksa data dan coba lagi.");
  }
  revalidatePath("/products");
  redirect("/products?success=product_created");
}

export async function updateProduct(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) fail("Produk tidak valid.");
  const product = readProduct(formData);
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_products").update(product).eq("id", id).eq("business_id", businessId);
  if (error) {
    if (error.code === "23505") fail("SKU tersebut sudah digunakan produk lain.");
    if (error.code === "23503") fail("Kategori yang dipilih tidak valid.");
    fail("Produk gagal diperbarui.");
  }
  revalidatePath("/products");
  redirect("/products?success=product_updated");
}

export async function setProductActive(formData: FormData) {
  const id = textValue(formData, "id");
  const active = textValue(formData, "active") === "true";
  if (!id) fail("Produk tidak valid.");

  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_products").update({ is_active: active }).eq("id", id).eq("business_id", businessId);
  if (error) fail("Status produk gagal diperbarui.");
  revalidatePath("/products");
  redirect(`/products?success=${active ? "product_activated" : "product_deactivated"}`);
}

export async function archiveProduct(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) fail("Produk tidak valid.");
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("kasir_products").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id).eq("business_id", businessId);
  if (error) fail("Produk gagal diarsipkan.");
  revalidatePath("/products");
  revalidatePath("/checkout");
  redirect("/products?success=product_archived");
}

export async function saveProductVariants(formData: FormData) {
  const productId = textValue(formData, "product_id");
  const groupName = textValue(formData, "group_name");
  const required = textValue(formData, "required") === "true";
  const rawOptions = textValue(formData, "options");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) fail("Produk tidak valid.");

  let options: unknown;
  try {
    options = JSON.parse(rawOptions);
  } catch {
    fail("Daftar pilihan varian tidak valid.");
  }
  if (!Array.isArray(options) || options.length > 12) fail("Varian dapat berisi maksimal 12 pilihan.");
  const parsedOptions = options.map((option: unknown) => {
    if (!option || typeof option !== "object" || !("name" in option) || !("price_delta" in option)
      || typeof option.name !== "string" || typeof option.price_delta !== "number"
      || !Number.isSafeInteger(option.price_delta) || Math.abs(option.price_delta) > 1_000_000_000) {
      fail("Nama dan selisih harga setiap pilihan harus valid.");
    }
    const name = option.name.trim();
    if (!name || name.length > 80) fail("Nama pilihan wajib diisi (maksimal 80 karakter).");
    return { name, price_delta: option.price_delta };
  });
  if (parsedOptions.length > 0 && (!groupName || groupName.length > 80)) fail("Nama kelompok varian wajib diisi (maksimal 80 karakter).");

  const { supabase } = await getBusinessContext();
  const { error } = await supabase.rpc("kasir_save_product_variants", {
    p_product_id: productId,
    p_group_name: groupName || null,
    p_required: required,
    p_options: parsedOptions,
  });
  if (error) {
    if (error.message.toLowerCase().includes("product not found")) fail("Produk tidak ditemukan atau sudah diarsipkan.");
    if (error.code === "PGRST202" || error.code === "42883") fail("Fungsi varian belum tersedia. Terapkan migrasi Supabase terbaru.");
    fail("Varian gagal disimpan. Periksa pilihan dan coba lagi.");
  }
  revalidatePath("/products");
  revalidatePath("/checkout");
  redirect("/products?success=variants_saved");
}
