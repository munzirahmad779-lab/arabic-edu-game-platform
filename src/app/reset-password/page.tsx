"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setHasSession(Boolean(data.user));
      setChecking(false);
    })();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });

      if (updErr) {
        setError(updErr.message);
      } else {
        setInfo("✓ تم تغيير كلمة المرور بنجاح. جاري تحويلك...");
        window.setTimeout(() => {
          router.replace("/dashboard");
          router.refresh();
        }, 1500);
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-6"
        dir="rtl"
      >
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-sm text-neutral-500">جاري التحقق من الرابط...</p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-rose-50 p-6"
        dir="rtl"
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="text-5xl">⛔</div>
          <h1 className="mt-4 text-xl font-black text-red-700">
            رابط غير صالح أو منتهي
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            الرابط غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد من صفحة تسجيل
            الدخول.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white"
          >
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6"
      dir="rtl"
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-black text-neutral-900">
            🔒 كلمة مرور جديدة
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            أدخل كلمة المرور الجديدة مرتين.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-xl"
        >
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-bold text-neutral-700"
            >
              كلمة المرور الجديدة
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="new-password"
              dir="ltr"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm"
              className="block text-sm font-bold text-neutral-700"
            >
              تأكيد كلمة المرور
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="new-password"
              dir="ltr"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          {info ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
            >
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {submitting ? "..." : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      </div>
    </main>
  );
}