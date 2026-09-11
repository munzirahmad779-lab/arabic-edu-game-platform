import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Still uses only the public URL + anon key (never the service-role key).
 * The user's session is read from cookies, so RLS is enforced as that user
 * (auth.uid()) — this is the "authenticated" role in the RLS policies, not
 * an elevated/service role.
 *
 * IMPORTANT: In a Server Component, cookies() is read-only, so setAll below
 * is wrapped in try/catch. Session refresh writes are actually performed in
 * middleware.ts, which *can* write cookies on every request. This split
 * (Server Component = read, Middleware = refresh/write) is the pattern
 * documented by @supabase/ssr for the Next.js App Router.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in your Supabase project values."
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore because middleware.ts refreshes the session on
          // every request.
        }
      },
    },
  });
}
