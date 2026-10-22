import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/shared/config/env";

export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env.configured) {
    throw new Error(`Supabase is not configured. Missing: ${env.missing.join(", ")}`);
  }

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies. Refresh sessions in a Route Handler or Server Action.
        }
      },
    },
  });
}
