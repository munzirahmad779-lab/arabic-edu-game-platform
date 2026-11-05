"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ResetPasswordButton } from "./reset-password-button";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

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

export function TeacherList({
  teachers,
  dict,
}: {
  teachers: Teacher[];
  dict: Dict;
}) {
  const t = dict.admin;
  const [processing, setProcessing] = useState<string | null>(null);
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam) sehingga aksi berhenti tanpa jejak.
  async function toggleActive(teacher: Teacher) {
    if (processing) return;

    setProcessing(teacher.id);
    try {
      const supabase = createClient();
      const { error } = teacher.is_active
        ? await supabase.rpc("admin_deactivate_teacher", {
            p_teacher_id: teacher.id,
          })
        : await supabase.rpc("admin_activate_teacher", {
            p_teacher_id: teacher.id,
          });
      if (error) {
        alert(`${t.error_prefix} ${error.message}`);
      } else {
        window.location.reload();
      }
    } catch {
      alert(t.connection_error);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-neutral-900">
            {t.teachers_title}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">{t.teachers_desc}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">
          {teachers.length} {t.teachers_count_suffix}
        </span>
      </div>

      {teachers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <div className="text-4xl">👤</div>
          <p className="mt-3 text-sm font-bold text-neutral-700">
            {t.teachers_empty}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                teacher.is_active
                  ? "border-neutral-200 bg-white"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white ${
                    teacher.is_active
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                      : "bg-red-400"
                  }`}
                >
                  {(teacher.full_name || teacher.email)
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "?"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black text-neutral-900">
                      {teacher.full_name || t.no_name}
                    </p>
                    {!teacher.is_active ? (
                      <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-black text-red-800">
                        {t.suspended}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-0.5 truncate text-xs text-neutral-500"
                    dir="ltr"
                  >
                    {teacher.email}
                  </p>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    {teacher.class_count} {t.meta_classes} ·{" "}
                    {teacher.student_count} {t.meta_students} ·{" "}
                    {t.meta_registered} {formatDate(teacher.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <ResetPasswordButton
                  email={teacher.email}
                  name={teacher.full_name || ""}
                  dict={dict as never}
                />

                <button
                  type="button"
                  onClick={() => setPendingTeacher(teacher)}
                  disabled={processing === teacher.id}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                    teacher.is_active
                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {processing === teacher.id
                    ? "..."
                    : teacher.is_active
                      ? t.btn_deactivate
                      : t.btn_activate}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`${pendingTeacher.is_active ? t.confirm_deactivate : t.confirm_activate} ${t.confirm_toggle_mid} "${pendingTeacher.full_name || pendingTeacher.email}"${t.confirm_toggle_end}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTeacher(null)}
                disabled={processing !== null}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const teacher = pendingTeacher;
                  setPendingTeacher(null);
                  void toggleActive(teacher);
                }}
                disabled={processing !== null}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 ${
                  pendingTeacher.is_active
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {pendingTeacher.is_active ? t.btn_deactivate : t.btn_activate}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}