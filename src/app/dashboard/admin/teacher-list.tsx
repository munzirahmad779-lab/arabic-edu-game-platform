"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ResetPasswordButton } from "./reset-password-button";

type Teacher = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  class_count: number;
  student_count: number;
};

function formatDate(v: string): string {
  try {
    const d = new Date(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export function TeacherList({ teachers }: { teachers: Teacher[] }) {
  const [processing, setProcessing] = useState<string | null>(null);

  async function toggleActive(t: Teacher) {
    if (processing) return;

    const action = t.is_active ? "إيقاف" : "تفعيل";
    if (
      !window.confirm(
        `${action} حساب "${t.full_name || t.email}"؟ ${
          t.is_active
            ? "لن يتمكن من الدخول إلى لوحة التحكم بعد ذلك."
            : "سيتمكن من الدخول مجددًا."
        }`,
      )
    ) {
      return;
    }

    setProcessing(t.id);
    try {
      const supabase = createClient();
      const rpcName = t.is_active
        ? "admin_deactivate_teacher"
        : "admin_activate_teacher";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc(rpcName, {
        p_teacher_id: t.id,
      });
      if (error) {
        alert(`خطأ: ${error.message}`);
      } else {
        window.location.reload();
      }
    } catch {
      alert("تعذر الاتصال بالخادم.");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-neutral-900">
            👥 حسابات المعلمين
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            يمكنك إيقاف أي حساب، أو إرسال رابط إعادة تعيين كلمة المرور له.
          </p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">
          {teachers.length} حساب
        </span>
      </div>

      {teachers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <div className="text-4xl">👤</div>
          <p className="mt-3 text-sm font-bold text-neutral-700">
            لا يوجد معلمون آخرون
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            هذا الحساب هو الحساب الوحيد المسجّل.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {teachers.map((t) => (
            <div
              key={t.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                t.is_active
                  ? "border-neutral-200 bg-white"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white ${
                    t.is_active
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                      : "bg-red-400"
                  }`}
                >
                  {(t.full_name || t.email).trim().charAt(0).toUpperCase() ||
                    "?"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black text-neutral-900">
                      {t.full_name || "بدون اسم"}
                    </p>
                    {!t.is_active ? (
                      <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-black text-red-800">
                        موقوف
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-0.5 truncate text-xs text-neutral-500"
                    dir="ltr"
                  >
                    {t.email}
                  </p>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    {t.class_count} فصل · {t.student_count} طالب · سجّل في{" "}
                    {formatDate(t.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <ResetPasswordButton email={t.email} name={t.full_name || ""} />

                <button
                  type="button"
                  onClick={() => void toggleActive(t)}
                  disabled={processing === t.id}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                    t.is_active
                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {processing === t.id
                    ? "..."
                    : t.is_active
                      ? "🚫 إيقاف"
                      : "✓ تفعيل"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}