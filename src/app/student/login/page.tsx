"use client";

import { useState } from "react";
import Link from "next/link";
import { Hero3D } from "@/components/three/hero-3d";
import { loginStudent } from "../actions";

export default function StudentLoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
          >
            <span className="text-lg">←</span>
            <span>الصفحة الرئيسية</span>
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
          >
            🎓 دخول المعلم
          </Link>
        </header>

        <section className="mt-8 grid items-center gap-8 lg:grid-cols-2 lg:mt-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              بوابة الطالب
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-neutral-900 sm:text-4xl">
              مرحبًا بك في
              <br />
              <span className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                بوابة الطالب
              </span>
            </h1>

            <p className="mt-4 text-sm leading-8 text-neutral-600 sm:text-base">
              سجّل دخولك بالاسم ورقم PIN الخاص بك، ثم اختر التدريب الذي تريده.
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
                  الاسم
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
                  PIN
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
                {submitting ? "..." : "دخول ←"}
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