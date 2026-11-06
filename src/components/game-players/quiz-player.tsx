"use client";

import { useState, useEffect, useRef } from "react";
import { pauseBackgroundAudio, resumeBackgroundAudio } from "@/lib/bg-audio-events";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { AnswerResult, GamePlayerProps, RawOption, RawQuestion } from "@/lib/game-engine/types";

export function QuizPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  // Waktu soal ini mulai ditampilkan, untuk menghitung responseTimeMs
  // yang nyata saat jawaban dikirim. Sebelumnya nilai itu mengeras
  // 1500 ms berapa pun kecepatan siswa menjawab (cacat K28).
  const questionShownAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setSelectedId(null);
    setSubmitting(false);
    setHasAnswered(false);
    questionShownAtRef.current = Date.now();
  }, [question.id]);

  const optionKeys = new Set(
    question.options.map((option) => option.option_key.trim().toUpperCase()),
  );
  const hasCompleteOptions =
    question.options.length === 4 &&
    optionKeys.size === 4 &&
    ["A", "B", "C", "D"].every((key) => {
      const option = question.options.find(
        (item) => item.option_key.trim().toUpperCase() === key,
      );
      const text = option
        ? option.option_text.trim().replace(/^[\[({<]+|[\])}>]+$/g, "").trim()
        : "";
      return optionKeys.has(key) && Boolean(text) && text.toLowerCase() !== `pilihan ${key.toLowerCase()}`;
    });

  async function handleOptionClick(option: RawOption) {
    if (submitting || hasAnswered) return;

    setSelectedId(option.id);
    setSubmitting(true);
    playSfx("click");

    // Kunci hasAnswered hanya dipasang SESUDAH server menerima
    // jawaban. Bila pengiriman ditolak (promise melempar) atau hasil
    // accepted: false, kunci dibebaskan supaya siswa dapat mencoba
    // lagi; jawaban yang tidak pernah tercatat tidak boleh mengunci
    // siswa secara permanen pada soal ini (cacat K28).
    const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);

    let result: AnswerResult;
    try {
      result = await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: option.id,
        answerText: null,
        responseTimeMs,
      });
    } catch {
      setSelectedId(null);
      setSubmitting(false);
      return;
    }

    if (!result.accepted) {
      setSelectedId(null);
      setSubmitting(false);
      return;
    }

    setHasAnswered(true);

    // Skor peristiwa umpan balik memakai nilai nyata dari hasil
    // server. Cadangannya mengikuti aturan platform sendiri di
    // room-store (benar 100, salah 0), bukan angka karangan di sini.
    const awarded = result.scoreAwarded ?? (result.isCorrect ? 100 : 0);

    if (result.isCorrect) {
      playSfx("correct");
      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: awarded,
        comboMultiplier: 1,
        streak: 1,
        consequence: "neutral",
        message: "Jawaban Benar! ✓",
      });
    } else {
      playSfx("wrong");
      onGameEvent?.({
        isCorrect: false,
        scoreAwarded: awarded,
        comboMultiplier: 1,
        streak: 0,
        consequence: "neutral",
        message: "Jawaban Kurang Tepat! ✗",
      });
    }

    setSubmitting(false);
  }

  return (
    <section
      className="space-y-6 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl sm:p-8"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Media Attachments */}
      {question.media && question.media.length > 0 && (
        <div className="space-y-4">
          {question.media.map((m) => {
            if (!m.public_url) return null;
            if (m.media_type === "image") {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.public_url}
                  alt=""
                  className="mx-auto max-h-80 rounded-2xl border-2 border-slate-200 object-contain shadow-sm"
                />
              );
            }
            if (m.media_type === "audio") {
              return (
                <div key={m.id} className="space-y-2 text-center">
                  <p className="text-xs font-bold text-teal-600">Dengarkan audio</p>
                  <audio
                    src={m.public_url}
                    controls
                    onPlay={() => pauseBackgroundAudio()}
                    onPause={() => resumeBackgroundAudio()}
                    onEnded={() => resumeBackgroundAudio()}
                    className="mx-auto w-full max-w-md"
                  />
                </div>
              );
            }
            if (m.media_type === "video") {
              return (
                <div key={m.id} className="space-y-2 text-center">
                  <p className="text-xs font-bold text-teal-600">Tonton video</p>
                  <video
                    src={m.public_url}
                    controls
                    onPlay={() => pauseBackgroundAudio()}
                    onPause={() => resumeBackgroundAudio()}
                    onEnded={() => resumeBackgroundAudio()}
                    className="mx-auto max-h-80 w-full rounded-2xl border-2 border-slate-200"
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Question Text */}
      <h2
        className="text-center text-2xl sm:text-3xl md:text-4xl font-black leading-relaxed text-slate-900 break-words"
        style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
        dir="auto"
      >
        {question.question_text}
      </h2>

      {/* Options List */}
      {!hasCompleteOptions ? (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 text-center font-bold text-rose-800"
        >
          Soal ini belum memiliki empat pilihan jawaban lengkap (A, B, C, D).
          Minta guru memperbaiki bank soal sebelum melanjutkan.
        </div>
      ) : (
        <div className="grid gap-3 pt-2">
          {question.options.map((option) => {
            const isSelected = selectedId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={submitting || hasAnswered}
                onClick={() => void handleOptionClick(option)}
                className={`rounded-2xl border-2 p-4 sm:p-5 text-start text-base sm:text-lg font-black shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed flex items-center gap-3 ${
                  isSelected
                    ? "border-terracotta-500 bg-terracotta-50 text-slate-950"
                    : "border-slate-200 bg-slate-50 hover:border-teal-500 hover:bg-teal-50 text-slate-900"
                }`}
              >
                <span
                  className={`shrink-0 inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-white shadow text-sm sm:text-base font-black ${
                    isSelected ? "bg-terracotta-500" : "bg-teal-600"
                  }`}
                >
                  {option.option_key}
                </span>
                <span
                  className="flex-1 break-words text-lg sm:text-xl font-bold leading-relaxed"
                  style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                  dir="auto"
                >
                  {option.option_text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
