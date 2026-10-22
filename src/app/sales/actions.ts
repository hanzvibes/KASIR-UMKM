"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function voidSaleAction(formData: FormData) {
  const saleId = formData.get("sale_id");
  const reason = formData.get("reason");
  if (typeof saleId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId)) {
    redirect("/sales?error=invalid_sale");
  }
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 240) {
    redirect(`/sales/${saleId}?error=invalid_reason`);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("kasir_business_members").select("business_id, role")
    .eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership) redirect("/onboarding");
  if (membership.role !== "owner") redirect(`/sales/${saleId}?error=owner_only`);

  const { error } = await supabase.rpc("kasir_void_sale", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("voided")) {
      redirect(`/sales/${saleId}?error=already_voided`);
    }
    if (message.includes("owner access")) redirect(`/sales/${saleId}?error=owner_only`);
    if (message.includes("sale not found")) redirect("/sales?error=not_found");
    redirect(`/sales/${saleId}?error=void_failed`);
  }

  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/reports");
  revalidatePath("/products");
  redirect(`/sales/${saleId}?success=voided`);
}
