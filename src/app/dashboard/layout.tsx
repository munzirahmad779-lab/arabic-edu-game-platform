import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./dashboard-themes.css";

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
    .select("full_name, email, theme, is_active")
    .eq("id", user.id)
    .single();

  if (profile && profile.is_active === false) {
    // Akun dinonaktifkan — logout paksa
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-rose-50 p-6"
        dir="rtl"
      >
        <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-2xl">
          <div className="text-6xl">🚫</div>
          <h1 className="mt-4 text-2xl font-black text-red-700">
            تم إيقاف حسابك
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            تم إيقاف حساب المعلم الخاص بك من قبل مسؤول المنصة. للاستفسار،
            تواصل مع الدعم.
          </p>
          <form action="/auth/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-2xl bg-red-600 px-6 py-3 text-base font-black text-white transition hover:bg-red-700"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </div>
    );
  }

  const theme = profile?.theme ?? "violet";

  return (
    <div data-theme={theme} className="min-h-screen bg-neutral-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
        <Link href="/dashboard" className="font-semibold">
          لوحة تحكم المعلم
        </Link>
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