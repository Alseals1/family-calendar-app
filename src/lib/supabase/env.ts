/**
 * Reads the public Supabase settings. Read lazily (inside functions), never at
 * module load, so `npm run build` works without the env. Property access is
 * literal so Next inlines the NEXT_PUBLIC_ values in client bundles.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey };
}
