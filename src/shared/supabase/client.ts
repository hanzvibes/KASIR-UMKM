"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/shared/config/env";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env.configured) {
    throw new Error(`Supabase is not configured. Missing: ${env.missing.join(", ")}`);
  }
  return createBrowserClient(env.url, env.anonKey);
}
