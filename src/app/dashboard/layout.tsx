import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-semibold">
            لوحة تحكم المعلم
          </Link>
          <Link
            href="/dashboard/settings/audio"
            className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
          >
            🎵 إعدادات الموسيقى
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-neutral-600 sm:inline" dir="ltr">
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