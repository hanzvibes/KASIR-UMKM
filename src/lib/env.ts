export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      configured: false as const,
      missing: [
        ...(!url ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
        ...(!anonKey ? ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] : []),
      ],
    };
  }

  try {
    new URL(url);
  } catch {
    return { configured: false as const, missing: ["NEXT_PUBLIC_SUPABASE_URL (must be a valid URL)"] };
  }

  return { configured: true as const, url, anonKey };
}
