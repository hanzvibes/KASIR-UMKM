"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const money = z.coerce.number().int().safe().min(0);

async function context() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: memberships }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (!user) redirect("/login");
  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");
  return { supabase, user, membership };
}

export async function openShiftAction(formData: FormData) {
  const parsed = money.safeParse(formData.get("opening_cash"));
  if (!parsed.success) redirect("/shifts?error=Nominal%20modal%20awal%20tidak%20valid");
  const { supabase } = await context();
  const { error } = await supabase.rpc("kasir_open_shift", { p_opening_cash: parsed.data });
  if (error) redirect(`/shifts?error=${encodeURIComponent(error.message.includes("duplicate") ? "Kamu sudah memiliki shift terbuka." : "Shift belum bisa dibuka. Periksa migrasi database.")}`);
  revalidatePath("/checkout");
  redirect("/checkout");
}

export async function addCashMovementAction(formData: FormData) {
  const parsed = z.object({ shift_id: z.string().uuid(), movement_type: z.enum(["cash_in", "cash_out"]), amount: money.min(1), reason: z.string().trim().min(1).max(240) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/shifts?error=Data%20kas%20masuk%20atau%20keluar%20tidak%20valid");
  const { supabase } = await context();
  const { error } = await supabase.rpc("kasir_add_cash_movement", { p_shift_id: parsed.data.shift_id, p_type: parsed.data.movement_type, p_amount: parsed.data.amount, p_reason: parsed.data.reason });
  if (error) redirect("/shifts?error=Pergerakan%20kas%20gagal%20disimpan");
  revalidatePath("/shifts");
  redirect("/shifts?success=movement");
}

export async function closeShiftAction(formData: FormData) {
  const parsed = z.object({ shift_id: z.string().uuid(), actual_cash: money, note: z.string().trim().max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/shifts?error=Jumlah%20uang%20hasil%20hitung%20tidak%20valid");
  const { supabase } = await context();
  const { error } = await supabase.rpc("kasir_close_shift", { p_shift_id: parsed.data.shift_id, p_actual_cash: parsed.data.actual_cash, p_note: parsed.data.note || null });
  if (error) redirect(`/shifts?error=${encodeURIComponent(error.message.includes("already closed") ? "Shift sudah ditutup." : "Shift belum bisa ditutup.")}`);
  revalidatePath("/checkout");
  revalidatePath("/shifts");
  redirect(`/shifts?success=closed&closed=${parsed.data.shift_id}`);
}
