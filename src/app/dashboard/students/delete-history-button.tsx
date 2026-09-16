"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MODE_AR: Record<string, string> = {
  competitive: "تنافسي",
  cooperative: "تعاوني",
  endless: "بلا نهاية",
  practice: "تمرين",
  learning: "تعليمي",
};

export function DeleteHistoryButton({
  studentId,
  studentName,
  mode,
}: {
  studentId: string;
  studentName: string;
  mode?: string;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;

    const label = mode
      ? `سجل "${MODE_AR[mode] ?? mode}" فقط`
      : "جميع السجلات";

    if (
      !window.confirm(
        `سيتم حذف ${label} للطالب "${studentName}" بشكل نهائي. متابعة؟`,
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
        alert(`خطأ: ${error.message}`);
      } else {
        window.location.reload();
      }
    } catch {
      alert("تعذر الاتصال بالخادم.");
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
        title={`حذف سجل ${MODE_AR[mode] ?? mode}`}
      >
        {deleting ? "..." : "🗑"}
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
      title="حذف سجل الطالب (كل الأوضاع)"
    >
      {deleting ? "..." : "🗑️ حذف السجل"}
    </button>
  );
}