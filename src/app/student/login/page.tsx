"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-neutral-500">...</p>
      </main>
    );
  }

  const t = dict.login_student;
  const c = dict.common;
  const isRtl = locale === "ar";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
          >
            <span className="text-lg">←</span>
            <span>{c.back_home}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher current={locale} />
            <Link
              href="/login"
              className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
            >
              🎓 {t.nav_teacher}
            </Link>
          </div>
        </header>

        <section className="mt-8 grid items-center gap-8 lg:mt-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t.portal_title}
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-neutral-900 sm:text-4xl">
              {t.hero_line1}
              <br />
              <span className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                {t.hero_line2}
              </span>
            </h1>

            <p className="mt-4 text-sm leading-8 text-neutral-600 sm:text-base">
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
              className="mt-6 space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-bold text-neutral-700"
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
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-sm font-bold text-neutral-700"
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
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {submitting ? "..." : `${t.btn_login} ←`}
              </button>
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-emerald-200/50 to-teal-200/50 blur-2xl" />
            <Hero3D />
          </div>
        </section>
      </div>
    </main>
  );
}