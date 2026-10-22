"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const optionalUrl = z.union([z.literal(""), z.string().url().max(2048)]).transform((value) => value || null);
const schema = z.object({ name: z.string().trim().min(1).max(120), business_type: z.enum(["makanan", "minuman", "retail", "jasa", "lainnya"]), address: z.string().trim().max(300), phone: z.string().trim().max(40), logo_url: optionalUrl, qris_image_url: optionalUrl, receipt_footer: z.string().trim().max(240), receipt_width: z.coerce.number().refine((value) => value === 58 || value === 80) });

export async function updateSettingsAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings?error=Periksa%20kembali%20data%20pengaturan");
  const supabase = await createClient();
  const [{ data: { user } }, { data: members }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (!user) redirect("/login");
  const member = members?.[0];
  if (!member) redirect("/onboarding");
  if (member.role !== "owner") redirect("/settings?error=Hanya%20pemilik%20yang%20dapat%20mengubah%20pengaturan");
  const { error } = await supabase.from("kasir_businesses").update(parsed.data).eq("id", member.business_id);
  if (error) redirect("/settings?error=Pengaturan%20gagal%20disimpan.%20Periksa%20migrasi%20Supabase");
  revalidatePath("/settings");
  redirect("/settings?success=saved");
}
