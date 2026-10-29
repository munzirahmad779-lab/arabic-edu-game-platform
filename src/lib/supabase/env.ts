/**
 * Supabase environment presence check.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so this works in both
 * server and client components. Components mounted globally (e.g. the
 * background-audio widget in the root layout) must use this before calling
 * `createClient()`, otherwise a missing `.env.local` throws during hydration
 * and breaks every route — including routes that do not use the database.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
