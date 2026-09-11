import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Defense-in-depth: middleware already redirects unauthenticated requests
 * away from /dashboard/*, but this layout re-checks the session server-side
 * before rendering anything, so a protected page never renders even if the
 * middleware matcher is changed incorrectly in the future.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <span className="font-semibold">لوحة تحكم المعلم</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600" dir="ltr">
            {profile?.full_name || profile?.email || user.email}
          </span>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
