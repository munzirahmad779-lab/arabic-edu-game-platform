"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteHistoryButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    if (
      !window.confirm(
        `سيتم حذف جميع سجلات نتائج "${studentName}" بشكل نهائي. متابعة؟`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc(
        "teacher_delete_student_history",
        { p_student_id: studentId },
      );
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

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      title="حذف سجل الطالب"
    >
      {deleting ? "..." : "🗑️ حذف السجل"}
    </button>
  );
}