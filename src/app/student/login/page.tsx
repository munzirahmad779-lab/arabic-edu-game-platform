"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Hero3D } from "@/components/three/hero-3d";
import { loginStudent } from "../actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
} from "@/lib/i18n/dictionaries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DICT_CACHE: Record<string, any> = {};

async function loadDict(locale: Locale) {
  if (DICT_CACHE[locale]) return DICT_CACHE[locale];
  const mod = await import(`@/lib/i18n/${locale}.json`);
  DICT_CACHE[locale] = mod.default;
  return mod.default;
}

export default function StudentLoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dict, setDict] = useState<any>(null);

  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${LOCALE_COOKIE}=`))
      ?.split("=")[1];
    const loc: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
    setLocale(loc);
    void loadDict(loc).then(setDict);
  }, []);

  if (!dict) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F1E8] p-6">
        <p className="text-sm text-[#2B2B2B]/60">...</p>
      </main>
    );
  }

  const t = dict.login_student;
  const c = dict.common;
  const isRtl = locale === "ar";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#F7F1E8]"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#8FA68E]/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#D97757]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-[#2F6D72] transition hover:text-[#1F4A4E]"
          >
            <span className="text-lg">←</span>
            <span>{c.back_home}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher current={locale} />
            <Link
              href="/assessment"
              className="rounded-xl border border-[#D97757]/40 bg-white px-4 py-2 text-xs font-bold text-[#C25F3E] transition hover:bg-[#D97757]/10"
            >
              📝 Ikut Ujian
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[#8FA68E]/40 bg-white px-4 py-2 text-xs font-bold text-[#2F6D72] transition hover:bg-[#8FA68E]/10"
            >
              🎓 {t.nav_teacher}
            </Link>
          </div>
        </header>

        <section className="mt-8 grid items-center gap-8 lg:mt-12 lg:grid-cols-2">
          <div>
            <div className="mb-5 flex justify-start">
              <Image
                src="/logo-horizontal.png"
                alt={c.brand_main}
                width={400}
                height={175}
                className="h-16 w-auto sm:h-20"
                priority
              />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#2F6D72]/30 bg-white/70 px-4 py-1.5 text-xs font-bold text-[#2F6D72] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#8FA68E]" />
              {t.portal_title}
            </div>

            <h1 className="font-display mt-5 text-3xl font-black leading-tight text-[#1F4A4E] sm:text-4xl">
              {t.hero_line1}
              <br />
              <span className="text-[#D97757]">{t.hero_line2}</span>
            </h1>

            <p className="mt-4 text-sm leading-8 text-[#2B2B2B]/70 sm:text-base">
              {t.hero_desc}
            </p>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {error}
              </div>
            ) : null}

            <form
              action={async (fd) => {
                setSubmitting(true);
                setError(null);
                await loginStudent(fd);
                setSubmitting(false);
              }}
              className="mt-6 space-y-4 rounded-3xl border border-[#8FA68E]/30 bg-white p-6 shadow-xl"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-bold text-[#1F4A4E]"
                >
                  {t.label_name}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-[#8FA68E]/40 bg-[#FBF7F0] px-4 py-3 outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-sm font-bold text-[#1F4A4E]"
                >
                  {t.label_pin}
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  minLength={4}
                  maxLength={6}
                  required
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-[#8FA68E]/40 bg-[#FBF7F0] px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-[#D97757] px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#C25F3E] disabled:opacity-60"
              >
                {submitting ? "..." : `${t.btn_login} ←`}
              </button>
            </form>

            <div className="mt-4 rounded-2xl border-2 border-dashed border-[#D97757]/40 bg-[#D97757]/5 p-4 text-center">
              <p className="text-xs font-bold text-[#C25F3E]">
                📝 Punya token ujian? Langsung masuk tanpa login.
              </p>
              <Link
                href="/assessment"
                className="mt-2 inline-flex rounded-full bg-[#D97757] px-5 py-2 text-xs font-black text-white transition hover:bg-[#C25F3E]"
              >
                Ikut Ujian TOEFL/TOAFL →
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-[#8FA68E]/40 to-[#D97757]/20 blur-2xl" />
            <Hero3D />
          </div>
        </section>
      </div>
    </main>
  );
}