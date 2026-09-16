import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Hero3D } from "@/components/three/hero-3d";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.home;
  const c = dict.common;

  const isRtl = locale === "ar";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-fuchsia-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md">
              ✦
            </span>
            <div>
              <p className="text-xs font-bold text-violet-600">
                {c.brand_top}
              </p>
              <p className="text-sm font-black text-neutral-900">
                {c.brand_main}
              </p>
              <p className="text-[10px] font-bold text-neutral-500">
                {c.brand_by}
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher current={locale} />

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-700"
              >
                {c.nav_dashboard} →
              </Link>
            ) : (
              <>
                <Link
                  href="/student/login"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                >
                  👥 {c.nav_student}
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-700"
                >
                  {c.nav_teacher}
                </Link>
              </>
            )}
          </nav>
        </header>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-sm sm:text-sm">
          <span className="text-xl">🔊</span>
          <p className="flex-1">
            <b>{t.audio_hint_title}:</b> {t.audio_hint_text}
          </p>
        </div>

        <section className="mt-8 grid items-center gap-8 lg:mt-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-1.5 text-xs font-bold text-violet-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t.badge_updated}
            </div>

            <h1 className="text-4xl font-black leading-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              {t.hero_line1}
              <br />
              <span className="bg-gradient-to-l from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                {t.hero_line2}
              </span>
            </h1>

            <p className="max-w-xl text-base leading-8 text-neutral-600 sm:text-lg">
              {t.hero_desc}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-6 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
              >
                🎓 {t.cta_teacher}
              </Link>
              <Link
                href="/student/login"
                className="rounded-2xl border-2 border-violet-200 bg-white px-6 py-4 text-base font-black text-violet-700 shadow-md transition hover:-translate-y-0.5 hover:bg-violet-50"
              >
                👥 {t.cta_student}
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {[
                `🎮 ${t.badge_modes}`,
                `📖 ${t.badge_materials}`,
                `🎯 ${t.badge_practice}`,
                `📊 ${t.badge_reports}`,
                `🔊 ${t.badge_audio}`,
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-700 shadow-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-violet-200/50 to-fuchsia-200/50 blur-2xl" />
            <Hero3D />
          </div>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="🎮"
            title={t.feat_modes_title}
            desc={t.feat_modes_desc}
          />
          <FeatureCard
            icon="📊"
            title={t.feat_reports_title}
            desc={t.feat_reports_desc}
          />
          <FeatureCard
            icon="🎯"
            title={t.feat_practice_title}
            desc={t.feat_practice_desc}
          />
          <FeatureCard
            icon="📚"
            title={t.feat_bank_title}
            desc={t.feat_bank_desc}
          />
          <FeatureCard
            icon="🔊"
            title={t.feat_audio_title}
            desc={t.feat_audio_desc}
          />
          <FeatureCard
            icon="🎨"
            title={t.feat_themes_title}
            desc={t.feat_themes_desc}
          />
        </section>

        <section className="mt-16 rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-8 text-white shadow-2xl sm:p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-black sm:text-3xl">{t.cta_ready}</h2>
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              {t.cta_ready_desc}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-2xl bg-white px-6 py-3.5 text-base font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5"
              >
                {t.cta_start} →
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500">
          <p>{t.footer_by}</p>
          <p className="mt-1">{t.footer_sub}</p>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md">
        {icon}
      </span>
      <h3 className="mt-4 font-black text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm leading-7 text-neutral-600">{desc}</p>
    </article>
  );
}