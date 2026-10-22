import { z } from "zod";

const publicEnvSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
});

export function getSupabasePublicEnv() {
  const raw = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const parsed = publicEnvSchema.safeParse(raw);

  if (parsed.success) {
    return { configured: true as const, ...parsed.data };
  }

  const missing: string[] = [];
  if (!raw.url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  else if (parsed.error.issues.some((issue) => issue.path[0] === "url")) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL (must be a valid URL)");
  }
  if (!raw.anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { configured: false as const, missing };
}
