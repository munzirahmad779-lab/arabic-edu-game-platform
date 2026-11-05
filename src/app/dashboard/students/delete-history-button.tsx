"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DeleteHistoryDict = {
  confirm_mode_prefix: string;
  confirm_mode_suffix: string;
  confirm_all: string;
  confirm_body_prefix: string;
  confirm_body_mid: string;
  confirm_body_suffix: string;
  error_prefix: string;
  connection_error: string;
  btn_delete_all: string;
  btn_delete_all_title: string;
  btn_delete_mode_title: string;
  loading: string;
  cancel?: string;
  // untuk label mode spesifik (opsional, fallback ke mode mentah)
  mode_competitive?: string;
  mode_cooperative?: string;
  mode_endless?: string;
  mode_practice?: string;
  mode_learning?: string;
};

const MODE_KEY: Record<string, keyof DeleteHistoryDict> = {
  competitive: "mode_competitive",
  cooperative: "mode_cooperative",
  endless: "mode_endless",
  practice: "mode_practice",
  learning: "mode_learning",
};

export function DeleteHistoryButton({
  studentId,
  studentName,
  mode,
  dict,
}: {
  studentId: string;
  studentName: string;
  mode?: string;
  dict: DeleteHistoryDict;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function modeLabel(m: string): string {
    const k = MODE_KEY[m];
    const v = k ? dict[k] : undefined;
    return (typeof v === "string" ? v : null) ?? m;
  }

  const scopeLabel = mode
    ? `${dict.confirm_mode_prefix}${modeLabel(mode)}${dict.confirm_mode_suffix}`
    : dict.confirm_all;
  const confirmMessage = `${dict.confirm_body_prefix}${scopeLabel}${dict.confirm_body_mid}${studentName}${dict.confirm_body_suffix}`;

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam) sehingga aksi berhenti tanpa jejak.
  async function handleDelete() {
    if (deleting) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      let error: { message: string } | null = null;

      if (mode) {
        const res = await supabase.rpc(
          "teacher_delete_student_history_by_mode",
          { p_student_id: studentId, p_mode: mode },
        );
        error = res.error;
      } else {
        const res = await supabase.rpc(
          "teacher_delete_student_history",
          { p_student_id: studentId },
        );
        error = res.error;
      }

      if (error) {
        alert(`${dict.error_prefix}${error.message}`);
      } else {
        window.location.reload();
      }
    } catch {
      alert(dict.connection_error);
    } finally {
      setDeleting(false);
    }
  }

  const confirmModal = showConfirm ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
          {confirmMessage}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            disabled={deleting}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {dict.cancel ?? "Batal"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              void handleDelete();
            }}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {mode ? "Hapus" : dict.btn_delete_all}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Tombol kecil untuk per-mode (ikon saja)
  if (mode) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={deleting}
          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          title={`${dict.btn_delete_mode_title}${modeLabel(mode)}`}
        >
          {deleting ? dict.loading : "🗑"}
        </button>
        {confirmModal}
      </>
    );
  }

  // Tombol besar untuk hapus semua
  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={deleting}
        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        title={dict.btn_delete_all_title}
      >
        {deleting ? dict.loading : dict.btn_delete_all}
      </button>
      {confirmModal}
    </>
  );
}