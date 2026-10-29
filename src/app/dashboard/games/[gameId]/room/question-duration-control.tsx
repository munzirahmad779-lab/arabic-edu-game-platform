"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MIN_QUESTION_DURATION_SECONDS,
  QUESTION_DURATION_OPTIONS,
} from "@/lib/game-engine/question-duration";

type DurationDict = {
  question_duration_label?: string;
  question_duration_hint?: string;
  question_duration_auto?: string;
  question_duration_seconds_unit?: string;
  question_duration_saving?: string;
  error_prefix?: string;
  connection_error?: string;
};

/**
 * Pengaturan durasi per soal oleh guru (keputusan user 29 Okt 2026):
 * minimal 30 detik, dapat diubah sebelum mulai maupun saat permainan
 * berjalan. Nilai tersimpan di rooms.question_duration_seconds lewat rute
 * kontrol aksi "set_duration" (DB adalah sumber kebenaran); pilihan
 * "Otomatis" mengosongkan override sehingga durasi mengikuti difficulty
 * soal dengan lantai 30 detik. Perubahan berlaku sejak soal yang sedang
 * berjalan karena deadline selalu dihitung dari question_started_at +
 * durasi efektif terbaru di DB.
 */
export function QuestionDurationControl({
  roomId,
  initialDurationSeconds,
  gr,
  isRtl = false,
}: {
  roomId: string;
  initialDurationSeconds: number | null;
  gr?: DurationDict;
  isRtl?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(
    initialDurationSeconds ? String(initialDurationSeconds) : "",
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const label = gr?.question_duration_label ?? "Durasi per Soal";
  const hint =
    gr?.question_duration_hint ??
    `Minimal ${MIN_QUESTION_DURATION_SECONDS} detik per soal. Berlaku sejak soal yang sedang berjalan.`;
  const autoLabel =
    gr?.question_duration_auto ?? "Otomatis (ikut tingkat kesulitan soal)";
  const unit = gr?.question_duration_seconds_unit ?? "detik";
  const savingLabel = gr?.question_duration_saving ?? "Menyimpan...";
  const errPrefix = gr?.error_prefix ?? "Error:";
  const connError = gr?.connection_error ?? "Gagal terhubung ke server.";

  async function handleChange(next: string) {
    if (saving) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/rooms/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          action: "set_duration",
          durationSeconds: next === "" ? null : Number(next),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setValue(previous);
        setErrorMsg(`${errPrefix} ${data.error || "Gagal menyimpan durasi"}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error("[QuestionDurationControl] Exception:", e);
      setValue(previous);
      setErrorMsg(connError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="mt-5 space-y-2 rounded-3xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <label
        htmlFor={`question-duration-${roomId}`}
        className="flex items-center gap-2 text-sm font-black text-sky-950"
      >
        <span aria-hidden>⏱️</span>
        {label}
      </label>

      <select
        id={`question-duration-${roomId}`}
        value={value}
        disabled={saving}
        onChange={(e) => void handleChange(e.target.value)}
        className="w-full rounded-2xl border border-sky-300 bg-white px-4 py-3 text-sm font-bold text-sky-950 shadow-sm transition focus:border-sky-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">{autoLabel}</option>
        {QUESTION_DURATION_OPTIONS.map((seconds) => (
          <option key={seconds} value={String(seconds)}>
            {seconds} {unit}
          </option>
        ))}
      </select>

      <p className="text-xs leading-relaxed text-sky-800">{hint}</p>
      {saving ? (
        <p className="text-xs font-bold text-sky-700">{savingLabel}</p>
      ) : null}
      {errorMsg ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
