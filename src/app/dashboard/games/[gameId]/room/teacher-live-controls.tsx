"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TeacherLiveControls({
  roomId,
  questionCount,
}: {
  roomId: string;
  questionCount: number;
}) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAdvanceQuestion() {
    if (advancing || ending) return;
    setAdvancing(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "teacher_advance_room_question",
        { p_room_id: roomId },
      );

      if (error) {
        setErrorMsg(`خطأ: ${error.message}`);
      } else {
        if (data?.[0]?.room_state === "ended") {
          router.refresh();
        } else {
          router.refresh();
        }
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleEndGame() {
    if (advancing || ending) return;
    if (
      !window.confirm(
        "هل تريد بالتأكيد إنهاء اللعبة الآن لجميع الطلاب ونقل الغرفة إلى النتائج النهائية؟",
      )
    ) {
      return;
    }

    setEnding(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("teacher_end_room_game", {
        p_room_id: roomId,
      });

      if (error) {
        setErrorMsg(`خطأ: ${error.message}`);
      } else {
        router.refresh();
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="mt-5 space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm font-black text-emerald-950">
            اللعبة جارية الآن
          </span>
        </div>
        <span className="rounded-full bg-emerald-200/80 px-3 py-0.5 text-xs font-black text-emerald-900">
          إجمالي الأسئلة: {questionCount}
        </span>
      </div>

      <p className="text-xs text-emerald-800 leading-relaxed">
        يمكنك التحكم في تقدم السؤال يدويًا في حال تأخر أحد المشاركين، أو إنهاء اللعبة بالكامل في أي وقت.
      </p>

      {errorMsg ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => void handleAdvanceQuestion()}
          disabled={advancing || ending}
          className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {advancing ? "جاري الانتقال..." : "⏭️ السؤال التالي"}
        </button>

        <button
          type="button"
          onClick={() => void handleEndGame()}
          disabled={advancing || ending}
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
        >
          {ending ? "جاري الإنهاء..." : "🛑 إنهاء اللعبة الآن"}
        </button>
      </div>
    </div>
  );
}
