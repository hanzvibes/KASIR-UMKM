"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fail(message: string): never {
  redirect(`/expenses?error=${encodeURIComponent(message)}`);
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createExpense(formData: FormData) {
  const category = field(formData, "category");
  const description = field(formData, "description");
  const amountRaw = field(formData, "amount");
  const expenseDate = field(formData, "expense_date");
  const amount = /^\d+$/.test(amountRaw) ? Number(amountRaw) : NaN;

  if (!category || category.length > 80) fail("Kategori wajib diisi (maksimal 80 karakter).");
  if (description.length > 240) fail("Catatan maksimal 240 karakter.");
  if (!Number.isSafeInteger(amount) || amount <= 0) fail("Nominal harus berupa rupiah bulat lebih dari nol.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || Number.isNaN(Date.parse(`${expenseDate}T00:00:00Z`))) {
    fail("Tanggal pengeluaran tidak valid.");
  }

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
  if (membership.role !== "owner") redirect("/expenses?error=owner_only");

  const { error } = await supabase.from("kasir_expenses").insert({
    business_id: membership.business_id,
    category,
    description: description || null,
    amount,
    expense_date: expenseDate,
    created_by: user.id,
  });
  if (error) fail("Pengeluaran gagal disimpan. Pastikan migrasi pengeluaran diterapkan di Supabase development.");

  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect("/expenses?success=created");
}
