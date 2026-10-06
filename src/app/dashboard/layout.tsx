import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./dashboard-themes.css";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

const SUPER_ADMIN_EMAIL = "munzirahmad779@gmail.com";

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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.dashboard;
  const sb = dict.sidebar;

  if (profile && profile.is_active === false) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-warmwhite p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-2xl">
          <div className="text-6xl">🚫</div>
          <h1 className="font-display mt-4 text-2xl font-black text-red-700">
            {t.deactivated_title}
          </h1>
          <p className="mt-3 text-sm text-softslate">{t.deactivated_desc}</p>
          <form action="/auth/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-2xl bg-red-600 px-6 py-3 text-base font-black text-white transition hover:bg-red-700"
            >
              {dict.dashboard.logout}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const theme = profile?.theme ?? "violet";
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const displayName = profile?.full_name || profile?.email || user.email || "";

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-warmwhite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <DashboardSidebar
        locale={locale}
        dict={sb}
        brandName={dict.common.brand_main}
        isSuperAdmin={isSuperAdmin}
      />

      <div className="lg:ps-60">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sage-200/60 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          {/* Logo + nama halaman */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="ms-12 flex items-center gap-2 lg:ms-0"
              aria-label={dict.common.brand_main}
            >
              <Image
                src="/logo-horizontal.png"
                alt={dict.common.brand_main}
                width={200}
                height={88}
                className="h-8 w-auto sm:h-9"
                priority
              />
            </Link>
            <span className="hidden text-sm font-bold text-softslate/40 sm:inline">
              /
            </span>
            <span className="hidden text-sm font-black text-teal-700 sm:inline">
              {sb.nav_dashboard}
            </span>
          </div>

          {/* Kanan: bahasa + nama + keluar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher current={locale} />
            <span
              className="hidden max-w-[160px] truncate text-sm font-bold text-softslate/80 sm:inline"
              dir="ltr"
            >
              {displayName}
            </span>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-sage-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 transition hover:bg-sage-50 sm:text-sm"
              >
                {dict.dashboard.logout}
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}