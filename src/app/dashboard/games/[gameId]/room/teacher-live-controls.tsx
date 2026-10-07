"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LiveControlsDict = {
  live_controls_title?: string;
  live_controls_desc?: string;
  next_question_btn?: string;
  next_question_loading?: string;
  end_game_btn?: string;
  end_game_loading?: string;
  end_game_confirm?: string;
  total_questions_badge?: string;
  error_prefix?: string;
  connection_error?: string;
};

export function TeacherLiveControls({
  roomId,
  questionCount,
  gr,
  isRtl = true,
}: {
  roomId: string;
  questionCount: number;
  gr?: LiveControlsDict;
  isRtl?: boolean;
}) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const title = gr?.live_controls_title ?? "اللعبة جارية الآن";
  const desc =
    gr?.live_controls_desc ??
    "يمكنك التحكم في تقدم السؤال يدويًا في حال تأخر أحد المشاركين، أو إنهاء اللعبة بالكامل في أي وقت.";
  const nextBtn = gr?.next_question_btn ?? "⏭️ السؤال التالي";
  const nextLoading = gr?.next_question_loading ?? "جاري الانتقال...";
  const endBtn = gr?.end_game_btn ?? "🛑 إنهاء اللعبة الآن";
  const endLoading = gr?.end_game_loading ?? "جاري الإنهاء...";
  const endConfirm =
    gr?.end_game_confirm ??
    "هل تريد بالتأكيد إنهاء اللعبة الآن لجميع الطلاب ونقل الغرفة إلى النتائج النهائية؟";
  const badge = gr?.total_questions_badge
    ? gr.total_questions_badge.replace("{count}", String(questionCount))
    : `إجمالي الأسئلة: ${questionCount}`;
  const errPrefix = gr?.error_prefix ?? "خطأ:";
  const connError = gr?.connection_error ?? "تعذر الاتصال بالخادم.";

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

      if (!error) {
        if (data?.[0]?.room_state === "ended") {
          router.refresh();
        } else {
          router.refresh();
        }
        return;
      }

      console.warn(
        "[TeacherLiveControls] advance RPC unavailable, trying direct update fallback:",
        error.message,
      );

      const { data: roomRow, error: fetchErr } = await supabase
        .from("rooms")
        .select("current_question_index, snapshot")
        .eq("id", roomId)
        .maybeSingle();

      if (fetchErr || !roomRow) {
        setErrorMsg(`${errPrefix} ${error.message}`);
        return;
      }

      const qList =
        (roomRow.snapshot as { questions?: unknown[] } | null)?.questions ?? [];
      const nextIdx = (roomRow.current_question_index ?? 0) + 1;
      const isEnded = nextIdx >= qList.length;

      if (isEnded) {
        const { error: directErr } = await supabase
          .from("rooms")
          .update({
            state: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("id", roomId);

        if (directErr) {
          console.error("[TeacherLiveControls] Direct advance end failed:", directErr);
          setErrorMsg(`${errPrefix} ${error.message}`);
        } else {
          router.refresh();
        }
      } else {
        const { error: directErr } = await supabase
          .from("rooms")
          .update({
            current_question_index: nextIdx,
            question_started_at: new Date(Date.now() + 3000).toISOString(),
          })
          .eq("id", roomId);

        if (directErr) {
          console.error("[TeacherLiveControls] Direct advance index failed:", directErr);
          setErrorMsg(`${errPrefix} ${error.message}`);
        } else {
          router.refresh();
        }
      }
    } catch (e) {
      console.error("[TeacherLiveControls] Exception during advance:", e);
      setErrorMsg(connError);
    } finally {
      setAdvancing(false);
    }
  }

  async function handleEndGame() {
    if (advancing || ending) return;
    if (!window.confirm(endConfirm)) {
      return;
    }

    setEnding(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("teacher_end_room_game", {
        p_room_id: roomId,
      });

      if (!error) {
        router.refresh();
        return;
      }

      console.warn(
        "[TeacherLiveControls] end_game RPC unavailable, trying direct update fallback:",
        error.message,
      );

      const { error: directError } = await supabase
        .from("rooms")
        .update({
          state: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", roomId);

      if (directError) {
        console.error("[TeacherLiveControls] Direct end failed:", directError);
        setErrorMsg(`${errPrefix} ${error.message}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error("[TeacherLiveControls] Exception during end game:", e);
      setErrorMsg(connError);
    } finally {
      setEnding(false);
    }
  }

  return (
    <div
      className="mt-5 space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm font-black text-emerald-950">
            {title}
          </span>
        </div>
        <span className="rounded-full bg-emerald-200/80 px-3 py-0.5 text-xs font-black text-emerald-900">
          {badge}
        </span>
      </div>

      <p className="text-xs text-emerald-800 leading-relaxed">
        {desc}
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
          {advancing ? nextLoading : nextBtn}
        </button>

        <button
          type="button"
          onClick={() => void handleEndGame()}
          disabled={advancing || ending}
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
        >
          {ending ? endLoading : endBtn}
        </button>
      </div>
    </div>
  );
}
