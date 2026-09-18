import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { HeroIllustration } from "@/components/hero-illustration";
import { Marquee } from "@/components/marquee";
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

  const marqueeItems = [
    { icon: "🎮", title: t.feat_modes_title, desc: "Kompetitif & kooperatif" },
    { icon: "📊", title: t.feat_reports_title, desc: "Siap analisis dengan AI" },
    { icon: "🎯", title: t.feat_practice_title, desc: "Bebas berlatih & evaluasi" },
    { icon: "📚", title: t.feat_bank_title, desc: "Template Excel siap pakai" },
    { icon: "🔊", title: t.feat_audio_title, desc: "Musik latar per halaman" },
    { icon: "🎨", title: t.feat_themes_title, desc: "Sesuaikan warna dashboard" },
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-warmwhite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] animate-blob-breathe rounded-full bg-sage-500/20 blur-3xl" />
        <div
          className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] animate-blob-breathe rounded-full bg-terracotta-500/15 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* ============ NAVBAR ============ */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-7">
        <Link
          href="/"
          className="flex items-center"
          aria-label={c.brand_main}
        >
          <Image
            src="/logo-horizontal.png"
            alt={c.brand_main}
            width={400}
            height={175}
            className="h-12 w-auto sm:h-14"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold text-teal-700/80 lg:flex">
          <a href="#fitur" className="transition hover:text-terracotta-500">
            Fitur
          </a>
          <a href="#ujian" className="transition hover:text-terracotta-500">
            Ujian
          </a>
          <a href="#modes" className="transition hover:text-terracotta-500">
            {t.feat_modes_title}
          </a>
          <a href="#laporan" className="transition hover:text-terracotta-500">
            {t.feat_reports_title}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={locale} />
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn-primary">
              {c.nav_dashboard} →
            </Link>
          ) : (
            <>
              <Link
                href="/student/login"
                className="hidden sm:inline-flex btn-secondary"
              >
                👥 {c.nav_student}
              </Link>
              <Link href="/login" className="btn-primary">
                {c.nav_teacher}
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ============ HERO ============ */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:pb-24 lg:pt-12">
        <div className="animate-fade-up flex w-full flex-col gap-6 lg:w-1/2">
          <div className="inline-flex w-max items-center gap-2 rounded-full border border-sage-200 bg-white/70 px-4 py-1.5 text-xs font-bold text-sage-600 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-terracotta-500" />
            {t.badge_updated}
          </div>

          <h1 className="font-display text-4xl font-black leading-[1.1] text-teal-700 sm:text-5xl lg:text-6xl">
            {t.hero_line1}
            <br />
            <span className="italic text-terracotta-500">
              {t.hero_line2}
            </span>
          </h1>

          <p className="mt-2 max-w-lg text-base leading-8 text-softslate sm:text-lg">
            {t.hero_desc}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary">
              🎓 {t.cta_teacher}
            </Link>
            <Link
              href="/student/login"
              className="text-sm font-black text-teal-700 underline-offset-4 transition hover:text-terracotta-500 hover:underline"
            >
              {t.cta_student} →
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {[
              `🎮 ${t.badge_modes}`,
              `🎯 ${t.badge_practice}`,
              `📊 ${t.badge_reports}`,
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-sage-200 bg-white/70 px-3 py-1 text-xs font-bold text-teal-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex w-full justify-center animate-soft-float lg:w-1/2">
          <HeroIllustration />
        </div>
      </main>

      {/* ============ SECTION TOEFL / TOAFL ============ */}
      <section
        id="ujian"
        className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6"
      >
        <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-terracotta-500/30 bg-gradient-to-br from-terracotta-50 via-white to-teal-50 p-8 shadow-xl sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-terracotta-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />

          <div className="relative">
            <div className="text-center">
              <p className="text-xs font-black tracking-widest text-terracotta-500">
                UNGGULAN
              </p>
              <h2 className="font-display mt-3 text-3xl font-black text-teal-700 sm:text-4xl">
                📝 Ujian TOEFL Prediction & TOAFL
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-softslate/80 sm:text-base">
                Simulasi ujian resmi TOEFL Prediction dan TOAFL dengan 3 section
                lengkap. Timer per section, audio sekali putar, bacaan, dan
                konversi skor otomatis 310–677 — sesuai standar asli.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-center">
                <div className="text-3xl">🎧</div>
                <p className="mt-2 text-xs font-black text-teal-700">
                  Listening
                </p>
                <p className="mt-1 text-[10px] text-softslate/70">
                  Audio sekali putar
                </p>
              </div>
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-center">
                <div className="text-3xl">📖</div>
                <p className="mt-2 text-xs font-black text-teal-700">
                  Structure
                </p>
                <p className="mt-1 text-[10px] text-softslate/70">
                  Bisa review
                </p>
              </div>
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-center">
                <div className="text-3xl">📚</div>
                <p className="mt-2 text-xs font-black text-teal-700">
                  Reading
                </p>
                <p className="mt-1 text-[10px] text-softslate/70">
                  Banyak bacaan
                </p>
              </div>
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-center">
                <div className="text-3xl">🏆</div>
                <p className="mt-2 text-xs font-black text-teal-700">
                  Skor 310–677
                </p>
                <p className="mt-1 text-[10px] text-softslate/70">
                  Konversi otomatis
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-teal-500/30 bg-white/80 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wider text-teal-600">
                  Untuk Guru
                </p>
                <h3 className="font-display mt-2 text-lg font-black text-teal-700">
                  Buat Ujian dengan AI
                </h3>
                <p className="mt-2 text-xs leading-6 text-softslate/80">
                  Generate soal otomatis dengan AI, atau paste draft soal Anda
                  untuk dirapikan. Buat token, pantau hasil.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-full bg-teal-700 px-5 py-2.5 text-xs font-black text-white transition hover:bg-teal-600"
                >
                  🎓 Masuk Guru →
                </Link>
              </div>

              <div className="rounded-2xl border border-terracotta-500/30 bg-white/80 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
                  Untuk Siswa
                </p>
                <h3 className="font-display mt-2 text-lg font-black text-teal-700">
                  Ikut Ujian dengan Token
                </h3>
                <p className="mt-2 text-xs leading-6 text-softslate/80">
                  Punya token dari guru? Langsung masuk dan kerjakan ujian
                  TOEFL Prediction atau TOAFL tanpa perlu daftar akun.
                </p>
                <Link
                  href="/assessment"
                  className="mt-4 inline-flex rounded-full bg-terracotta-500 px-5 py-2.5 text-xs font-black text-white transition hover:bg-terracotta-600"
                >
                  📝 Ikut Ujian →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE GRID ============ */}
      <section
        id="fitur"
        className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6"
      >
        <div className="mb-10 text-center">
          <p className="text-xs font-black tracking-widest text-terracotta-500">
            FITUR
          </p>
          <h2 className="font-display mt-3 text-3xl font-black text-teal-700 sm:text-4xl">
            Semua yang Anda butuhkan
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            id="modes"
            icon="🎮"
            title={t.feat_modes_title}
            desc={t.feat_modes_desc}
          />
          <FeatureCard
            id="laporan"
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
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-teal-500 to-teal-700 p-10 text-white shadow-2xl sm:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-terracotta-500/40 blur-3xl" />
          <div className="relative flex flex-col items-center gap-5 text-center">
            <h2 className="font-display text-3xl font-black sm:text-4xl">
              {t.cta_ready}
            </h2>
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              {t.cta_ready_desc}
            </p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-terracotta-500 px-7 py-3.5 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-600"
            >
              {t.cta_start} →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <Marquee items={marqueeItems} />

      {/* ============ FOOTER ============ */}
      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center text-xs text-softslate/70 sm:px-6">
        <Image
          src="/logo-horizontal.png"
          alt={c.brand_main}
          width={240}
          height={105}
          className="h-10 w-auto opacity-90"
        />
        <p>{t.footer_by}</p>
        <p>{t.footer_sub}</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  id,
  icon,
  title,
  desc,
}: {
  id?: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <article id={id} className="aesthetic-card scroll-mt-24">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-500 text-2xl text-white shadow-md">
        {icon}
      </span>
      <h3 className="font-display mt-5 text-lg font-black text-teal-700">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-softslate/80">{desc}</p>
    </article>
  );
}