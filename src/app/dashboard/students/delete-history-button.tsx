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

  function modeLabel(m: string): string {
    const k = MODE_KEY[m];
    const v = k ? dict[k] : undefined;
    return (typeof v === "string" ? v : null) ?? m;
  }

  async function handleDelete() {
    if (deleting) return;

    const label = mode
      ? `${dict.confirm_mode_prefix}${modeLabel(mode)}${dict.confirm_mode_suffix}`
      : dict.confirm_all;

    if (
      !window.confirm(
        `${dict.confirm_body_prefix}${label}${dict.confirm_body_mid}${studentName}${dict.confirm_body_suffix}`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const supabase = createClient();
      let error: { message: string } | null = null;

      if (mode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (supabase as any).rpc(
          "teacher_delete_student_history_by_mode",
          { p_student_id: studentId, p_mode: mode },
        );
        error = res.error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (supabase as any).rpc(
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

  // Tombol kecil untuk per-mode (ikon saja)
  if (mode) {
    return (
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        title={`${dict.btn_delete_mode_title}${modeLabel(mode)}`}
      >
        {deleting ? dict.loading : "🗑"}
      </button>
    );
  }

  // Tombol besar untuk hapus semua
  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      title={dict.btn_delete_all_title}
    >
      {deleting ? dict.loading : dict.btn_delete_all}
    </button>
  );
}