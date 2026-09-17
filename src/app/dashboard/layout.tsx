import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./dashboard-themes.css";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";

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
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-warmwhite p-6"
        dir="rtl"
      >
        <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-2xl">
          <div className="text-6xl">🚫</div>
          <h1 className="font-display mt-4 text-2xl font-black text-red-700">
            Akun Anda dinonaktifkan
          </h1>
          <p className="mt-3 text-sm text-softslate">
            Hubungi administrator untuk informasi lebih lanjut.
          </p>
          <form action="/auth/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-2xl bg-red-600 px-6 py-3 text-base font-black text-white transition hover:bg-red-700"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    );
  }

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const theme = profile?.theme ?? "violet";

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-warmwhite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sage-200/60 bg-white/80 px-4 py-4 backdrop-blur sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center"
          aria-label={dict.common.brand_main}
        >
          <Image
            src="/logo-horizontal.png"
            alt={dict.common.brand_main}
            width={240}
            height={105}
            className="h-10 w-auto sm:h-11"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={locale} />
          <span
            className="hidden text-sm text-softslate/80 sm:inline"
            dir="ltr"
          >
            {profile?.full_name || profile?.email || user.email}
          </span>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-sage-200 bg-white px-4 py-1.5 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
            >
              {dict.dashboard.logout}
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}