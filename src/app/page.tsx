import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Marquee } from "@/components/marquee";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";
import { HeroDualEntry } from "@/components/hero-dual-entry";

type Feature = {
  icon: string;
  title: string;
  desc: string;
};

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

  const features: Feature[] = [
    { icon: "🎮", title: t.feat_modes_title, desc: "Kompetitif & kooperatif" },
    { icon: "📊", title: t.feat_reports_title, desc: "Siap analisis dengan AI" },
    { icon: "🎯", title: t.feat_practice_title, desc: "Bebas berlatih & evaluasi" },
    { icon: "📚", title: t.feat_bank_title, desc: "Template Excel siap pakai" },
    { icon: "🔊", title: t.feat_audio_title, desc: "Musik latar per halaman" },
    { icon: "🎨", title: t.feat_themes_title, desc: "Sesuaikan warna dashboard" },
  ];

  const row1 = features.slice(0, 3);
  const row2 = features.slice(3, 6);

  const marqueeItems = features.map((f) => ({
    icon: f.icon,
    title: f.title,
    desc: f.desc,
  }));

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-warmwhite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* CSS marquee fitur */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marquee-feature-left {
              from { transform: translateX(0); }
              to   { transform: translateX(-50%); }
            }
            @keyframes marquee-feature-right {
              from { transform: translateX(-50%); }
              to   { transform: translateX(0); }
            }
            .marquee-row {
              display: flex;
              width: max-content;
              gap: 1rem;
              animation-duration: 40s;
              animation-timing-function: linear;
              animation-iteration-count: infinite;
            }
            .marquee-row--left  { animation-name: marquee-feature-left; }
            .marquee-row--right { animation-name: marquee-feature-right; }
            .marquee-row:hover  { animation-play-state: paused; }
            @media (max-width: 640px) {
              .marquee-row { animation-duration: 28s; }
            }
          `,
        }}
      />

      {/* Blob background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] animate-blob-breathe rounded-full bg-sage-500/20 blur-3xl" />
        <div
          className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] animate-blob-breathe rounded-full bg-terracotta-500/15 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* NAVBAR */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label={c.brand_main}>
          <Image
            src="/logo-horizontal.png"
            alt={c.brand_main}
            width={400}
            height={175}
            className="h-11 w-auto sm:h-12"
            priority
          />
        </Link>

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

      {/* ============ HERO (kiri teks, kanan Dual-Hero Entry) ============ */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:pb-14 lg:pt-8">
        <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:gap-12">
          {/* KIRI */}
          <div className="animate-fade-up flex w-full flex-col gap-5 lg:w-1/2">
            <div className="inline-flex w-max items-center gap-2 rounded-full border border-sage-200 bg-white/80 px-3.5 py-1.5 text-xs font-black text-teal-800 shadow-sm backdrop-blur-md">
              <span className="h-2.5 w-2.5 rounded-full bg-terracotta-500 animate-pulse" />
              <span>Belajar • Bermain • Berkembang</span>
            </div>

            <h1 className="font-display text-3xl font-black leading-tight text-teal-700 sm:text-4xl lg:text-5xl">
              {t.hero_line1}{" "}
              <span className="italic text-terracotta-500">
                {t.hero_line2}
              </span>
            </h1>

            <p className="max-w-lg text-sm leading-7 text-softslate sm:text-base">
              {t.hero_desc}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-bold text-softslate">
              <div className="flex items-center gap-1.5 rounded-xl bg-warmwhite/80 px-3 py-1.5 border border-sage-200/60">
                <span className="text-terracotta-500 text-sm">🎮</span> 5 Mode Permainan
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-warmwhite/80 px-3 py-1.5 border border-sage-200/60">
                <span className="text-teal-600 text-sm">🕌</span> Bahasa Arab & Kurikulum
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-warmwhite/80 px-3 py-1.5 border border-sage-200/60">
                <span className="text-sage-600 text-sm">⚡</span> Akses Instan Tanpa Ribet
              </div>
            </div>
          </div>

          {/* KANAN — Dual-Hero 1-Klik Entry Box */}
          <div className="w-full lg:w-1/2">
            <HeroDualEntry locale={locale} dict={t} />
          </div>
        </div>
      </main>

      {/* ============ TOEFL / TOAFL (UNGGULAN, langsung setelah hero) ============ */}
      <section
        id="ujian"
        className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-12 sm:px-6"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-terracotta-500/30 bg-gradient-to-br from-terracotta-50 via-white to-teal-50 p-6 shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-terracotta-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-widest text-terracotta-500">
                {isRtl ? "ميزة" : locale === "en" ? "FEATURED" : "UNGGULAN"}
              </p>
              <h2 className="font-display mt-2 text-2xl font-black text-teal-700 sm:text-3xl">
                📝{" "}
                {isRtl
                  ? "اختبار TOEFL Prediction و TOAFL"
                  : locale === "en"
                    ? "TOEFL Prediction & TOAFL Exam"
                    : "Ujian TOEFL Prediction & TOAFL"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-softslate/80">
                {isRtl
                  ? "محاكاة رسمية — الاستماع، التركيب، القراءة، مع تحويل النتيجة تلقائيًا 310-677."
                  : locale === "en"
                    ? "Official simulation — Listening, Structure, Reading, with auto score conversion 310-677."
                    : "Simulasi resmi — Listening, Structure, Reading, dengan konversi skor otomatis 310-677."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-white/80 px-3 py-1 text-teal-700 shadow-sm">
                  🎧 Listening
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-teal-700 shadow-sm">
                  📖 Structure
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-teal-700 shadow-sm">
                  📚 Reading
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-teal-700 shadow-sm">
                  🏆 310–677
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href="/login"
                className="rounded-full bg-teal-700 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-teal-600"
              >
                🎓 {c.nav_teacher} →
              </Link>
              <Link
                href="/assessment"
                className="rounded-full bg-terracotta-500 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-terracotta-600"
              >
                📝{" "}
                {isRtl
                  ? "ابدأ الاختبار"
                  : locale === "en"
                    ? "Take Exam"
                    : "Ikut Ujian"}{" "}
                →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FITUR BERGERAK (2 baris berlawanan arah) ============ */}
      <section id="fitur" className="relative z-10 w-full overflow-hidden py-8">
        <div className="mx-auto mb-6 max-w-6xl px-4 text-center sm:px-6">
          <p className="text-[10px] font-black tracking-widest text-terracotta-500">
            {isRtl ? "الميزات" : locale === "en" ? "FEATURES" : "FITUR"}
          </p>
          <h2 className="font-display mt-2 text-2xl font-black text-teal-700 sm:text-3xl">
            {isRtl
              ? "كل ما تحتاجه"
              : locale === "en"
                ? "Everything You Need"
                : "Semua yang Anda Butuhkan"}
          </h2>
        </div>

        {/* Baris 1 — kiri */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-warmwhite to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-warmwhite to-transparent sm:w-24" />

          <div className="marquee-row marquee-row--left py-2">
            {[...row1, ...row1].map((f, i) => (
              <FeatureCard key={`r1-${i}`} feature={f} />
            ))}
          </div>
        </div>

        {/* Baris 2 — kanan */}
        <div className="relative mt-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-warmwhite to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-warmwhite to-transparent sm:w-24" />

          <div className="marquee-row marquee-row--right py-2">
            {[...row2, ...row2].map((f, i) => (
              <FeatureCard key={`r2-${i}`} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-8 text-white shadow-xl sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-terracotta-500/40 blur-3xl" />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <h2 className="font-display text-2xl font-black sm:text-3xl">
              {t.cta_ready}
            </h2>
            <p className="max-w-xl text-sm text-white/85">{t.cta_ready_desc}</p>
            <Link
              href="/login"
              className="mt-1 inline-flex items-center justify-center rounded-full bg-terracotta-500 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-600"
            >
              {t.cta_start} →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE BAWAH ============ */}
      <Marquee items={marqueeItems} />

      {/* ============ FOOTER ============ */}
      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-xs text-softslate/70 sm:px-6">
        <Image
          src="/logo-horizontal.png"
          alt={c.brand_main}
          width={240}
          height={105}
          className="h-9 w-auto opacity-90"
        />
        <p>{t.footer_by}</p>
        <p>{t.footer_sub}</p>
      </footer>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article className="w-[280px] shrink-0 rounded-3xl border border-sage-200/60 bg-white p-5 shadow-md sm:w-[320px]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-terracotta-500 text-xl text-white shadow-md">
          {feature.icon}
        </span>
        <h3 className="font-display text-base font-black leading-tight text-teal-700">
          {feature.title}
        </h3>
      </div>
      <p className="mt-3 text-xs leading-6 text-softslate/80">
        {feature.desc}
      </p>
    </article>
  );
}