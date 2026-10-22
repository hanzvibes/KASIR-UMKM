"use server";

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerEnv } from "@/shared/config/server-env";
import { getSupabasePublicEnv } from "@/shared/config/env";
import { createClient } from "@/lib/supabase/server";

async function ownerContext() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: memberships }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (!user) redirect("/login");
  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner") redirect("/users?error=owner_only");
  return { supabase, user, businessId: membership.business_id };
}

function adminClient() {
  const publicEnv = getSupabasePublicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!publicEnv.configured || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createSupabaseClient(publicEnv.url, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function inviteCashierAction(formData: FormData) {
  const input = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254) }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/users?error=invalid");
  const { businessId, user } = await ownerContext();
  let admin;
  try { admin = adminClient(); } catch { redirect("/users?error=admin_setup"); }
  const [{ count }, { data: planLimit }] = await Promise.all([
    admin.from("kasir_business_members").select("user_id", { count: "exact", head: true }).eq("business_id", businessId).eq("role", "cashier").eq("active", true),
    admin.from("kasir_plan_limits").select("max_cashiers").eq("plan_code", "free").single(),
  ]);
  if (planLimit && count !== null && count >= planLimit.max_cashiers) redirect("/users?error=limit");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.data.email, { data: { name: input.data.name } });
  if (error || !data.user) redirect(`/users?error=${encodeURIComponent(error?.message.includes("already") ? "email_exists" : "invite_failed")}`);
  const { error: memberError } = await admin.from("kasir_business_members").insert({ business_id: businessId, user_id: data.user.id, role: "cashier", active: true, name: input.data.name });
  if (memberError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/users?error=${encodeURIComponent(memberError.message.includes("limit") ? "limit" : "invite_failed")}`);
  }
  await admin.from("kasir_audit_logs").insert({ business_id: businessId, actor_id: user.id, action: "cashier_invited", entity: "membership", entity_id: data.user.id, details: { email: input.data.email } });
  revalidatePath("/users");
  redirect("/users?success=invited");
}

export async function setCashierActiveAction(formData: FormData) {
  const input = z.object({ user_id: z.string().uuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/users?error=invalid");
  const { businessId, user } = await ownerContext();
  let admin;
  try { admin = adminClient(); } catch { redirect("/users?error=admin_setup"); }
  const { data: target, error: targetError } = await admin.from("kasir_business_members").select("user_id,role").eq("business_id", businessId).eq("user_id", input.data.user_id).single();
  if (targetError || !target || target.role !== "cashier") redirect("/users?error=not_found");
  const active = input.data.active === "true";
  const { error } = await admin.from("kasir_business_members").update({ active }).eq("business_id", businessId).eq("user_id", target.user_id);
  if (error) redirect(`/users?error=${encodeURIComponent(error.message.includes("limit") ? "limit" : "update_failed")}`);
  await admin.from("kasir_audit_logs").insert({ business_id: businessId, actor_id: user.id, action: active ? "cashier_reactivated" : "cashier_deactivated", entity: "membership", entity_id: target.user_id, details: {} });
  revalidatePath("/users");
  redirect(`/users?success=${active ? "reactivated" : "deactivated"}`);
}
