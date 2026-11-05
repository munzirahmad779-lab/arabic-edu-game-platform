"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionDurationControl } from "./question-duration-control";

type LiveControlsDict = {
  live_controls_title?: string;
  live_controls_desc?: string;
  next_question_btn?: string;
  next_question_loading?: string;
  end_game_btn?: string;
  end_game_loading?: string;
  end_game_confirm?: string;
  reset_game_btn?: string;
  reset_game_confirm?: string;
  confirm_cancel_btn?: string;
  total_questions_badge?: string;
  error_prefix?: string;
  connection_error?: string;
  question_duration_label?: string;
  question_duration_hint?: string;
  question_duration_auto?: string;
  question_duration_seconds_unit?: string;
  question_duration_saving?: string;
};

export function TeacherLiveControls({
  roomId,
  questionCount,
  initialQuestionDurationSeconds = null,
  gr,
  isRtl = false,
}: {
  roomId: string;
  questionCount: number;
  initialQuestionDurationSeconds?: number | null;
  gr?: LiveControlsDict;
  isRtl?: boolean;
}) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Konfirmasi Akhiri/Reset memakai modal di dalam halaman, BUKAN
  // window.confirm: dialog bawaan browser bisa tidak pernah sampai ke
  // pengguna (webview/otomasi menelannya diam-diam), sehingga handler klik
  // berhenti sebelum fetch dan tombol tampak mati tanpa pesan error
  // (temuan audit live 5 Nov 2026: Akhiri diklik 5 kali tanpa efek).
  const [pendingConfirm, setPendingConfirm] = useState<"end" | "reset" | null>(
    null,
  );

  const title = gr?.live_controls_title ?? "Permainan Sedang Berlangsung";
  const desc =
    gr?.live_controls_desc ??
    "Anda dapat memajukan soal berikutnya untuk seluruh siswa, mengulang sesi dari awal (Soal 1), atau mengakhiri permainan.";
  const nextBtn = gr?.next_question_btn ?? "⏭️ Soal Berikutnya";
  const nextLoading = gr?.next_question_loading ?? "Memuat...";
  const endBtn = gr?.end_game_btn ?? "🛑 Akhiri Permainan";
  const endLoading = gr?.end_game_loading ?? "Mengakhiri...";
  const endConfirm =
    gr?.end_game_confirm ??
    "Yakin ingin mengakhiri permainan sekarang dan menampilkan papan skor akhir?";
  const resetBtn = gr?.reset_game_btn ?? "🔄 Reset ke Awal";
  const resetConfirm =
    gr?.reset_game_confirm ??
    "Reset sesi ini kembali ke Soal 1 dan bersihkan jawaban sebelumnya?";
  const cancelBtn = gr?.confirm_cancel_btn ?? "Batal";
  const badge = gr?.total_questions_badge
    ? gr.total_questions_badge.replace("{count}", String(questionCount))
    : `Total Soal: ${questionCount}`;
  const errPrefix = gr?.error_prefix ?? "Error:";
  const connError = gr?.connection_error ?? "Gagal terhubung ke server.";

  async function runAction(action: "advance" | "end" | "reset") {
    if (advancing || ending || resetting) return;

    if (action === "advance") setAdvancing(true);
    if (action === "end") setEnding(true);
    if (action === "reset") setResetting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/rooms/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(`${errPrefix} ${data.error || "Gagal memproses aksi"}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error("[TeacherLiveControls] Exception:", e);
      setErrorMsg(connError);
    } finally {
      setAdvancing(false);
      setEnding(false);
      setResetting(false);
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
          <span className="text-sm font-black text-emerald-950">{title}</span>
        </div>
        <span className="rounded-full bg-emerald-200/80 px-3 py-0.5 text-xs font-black text-emerald-900">
          {badge}
        </span>
      </div>

      <p className="text-xs text-emerald-800 leading-relaxed">{desc}</p>

      {errorMsg ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => void runAction("advance")}
          disabled={advancing || ending || resetting}
          className="flex-1 min-w-[140px] rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {advancing ? nextLoading : nextBtn}
        </button>

        <button
          type="button"
          onClick={() => setPendingConfirm("reset")}
          disabled={advancing || ending || resetting}
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
        >
          {resetting ? "Mereset..." : resetBtn}
        </button>

        <button
          type="button"
          onClick={() => setPendingConfirm("end")}
          disabled={advancing || ending || resetting}
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
        >
          {ending ? endLoading : endBtn}
        </button>
      </div>

      <QuestionDurationControl
        roomId={roomId}
        initialDurationSeconds={initialQuestionDurationSeconds}
        gr={gr}
        isRtl={isRtl}
      />

      {pendingConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold leading-relaxed text-neutral-800">
              {pendingConfirm === "end" ? endConfirm : resetConfirm}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={ending || resetting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingConfirm;
                  setPendingConfirm(null);
                  void runAction(action);
                }}
                disabled={ending || resetting}
                className={
                  pendingConfirm === "end"
                    ? "rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    : "rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                }
              >
                {pendingConfirm === "end"
                  ? ending
                    ? endLoading
                    : endBtn
                  : resetting
                    ? "Mereset..."
                    : resetBtn}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
