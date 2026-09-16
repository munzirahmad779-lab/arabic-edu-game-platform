"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirectTo");
  const redirectTo =
    requestedRedirect &&
    requestedRedirect.startsWith("/") &&
    !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/dashboard";

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.replace(redirectTo);
        router.refresh();
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );
        if (resetError) {
          setError(resetError.message);
          return;
        }
        setInfoMessage(
          "✓ تم إرسال رابط إعادة التعيين إلى بريدك. تحقق من صندوق الوارد.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6"
      dir="rtl"
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-bold text-violet-600 hover:underline"
          >
            ← العودة إلى الصفحة الرئيسية
          </Link>
          <h1 className="mt-4 text-2xl font-black text-neutral-900">
            {mode === "sign_in" ? "🎓 دخول المعلم" : "🔑 نسيت كلمة المرور"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {mode === "sign_in"
              ? "أدخل بريدك وكلمة المرور للوصول إلى لوحة التحكم."
              : "أدخل بريدك الإلكتروني، وسنرسل لك رابط إعادة التعيين."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-xl"
          noValidate
        >
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-bold text-neutral-700"
            >
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          {mode === "sign_in" ? (
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-sm font-bold text-neutral-700"
              >
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          {infoMessage ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
            >
              {infoMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isSubmitting
              ? "..."
              : mode === "sign_in"
                ? "تسجيل الدخول"
                : "إرسال رابط إعادة التعيين"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign_in" ? "forgot" : "sign_in");
            setError(null);
            setInfoMessage(null);
          }}
          className="w-full text-center text-sm font-bold text-violet-700 underline"
        >
          {mode === "sign_in"
            ? "نسيت كلمة المرور؟"
            : "← العودة إلى تسجيل الدخول"}
        </button>

        <p className="text-center text-xs text-neutral-400">
          التسجيل مغلق. للاستفسار تواصل مع مسؤول المنصة.
        </p>
      </div>
    </main>
  );
}