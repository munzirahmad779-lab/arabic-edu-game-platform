"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirectTo");
  const redirectTo =
    requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/dashboard";

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || null },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setInfoMessage(
          "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد التسجيل قبل تسجيل الدخول."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">
            {mode === "sign_in" ? "تسجيل دخول المعلم" : "إنشاء حساب معلم"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "sign_up" && (
            <div className="space-y-1">
              <label htmlFor="fullName" className="block text-sm font-medium">
                الاسم الكامل
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              dir="ltr"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {infoMessage && (
            <p role="status" className="text-sm text-green-700">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {mode === "sign_in" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign_in" ? "sign_up" : "sign_in");
            setError(null);
            setInfoMessage(null);
          }}
          className="w-full text-center text-sm text-neutral-600 underline"
        >
          {mode === "sign_in"
            ? "ليس لديك حساب؟ إنشاء حساب جديد"
            : "لديك حساب بالفعل؟ تسجيل الدخول"}
        </button>
      </div>
    </main>
  );
}
