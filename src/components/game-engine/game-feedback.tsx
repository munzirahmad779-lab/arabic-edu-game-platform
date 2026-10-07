"use client";

import type { ConsequenceType } from "@/lib/game-engine/types";

interface GameFeedbackProps {
  readonly isVisible: boolean;
  readonly isCorrect: boolean;
  readonly consequence: ConsequenceType;
  readonly scoreAwarded?: number;
  readonly streak?: number;
  readonly message?: string;
  readonly correctAnswerText?: string;
}

export function GameFeedback({
  isVisible,
  isCorrect,
  consequence,
  scoreAwarded = 0,
  streak = 0,
  message,
  correctAnswerText,
}: GameFeedbackProps) {
  if (!isVisible) return null;

  const isBoost = consequence === "boost" || consequence === "goal";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div
        className={`rounded-2xl p-4 text-center shadow-2xl backdrop-blur-md border ${
          isCorrect
            ? "border-emerald-400/50 bg-emerald-600/90 text-white"
            : "border-rose-400/50 bg-rose-600/90 text-white"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">
            {isCorrect
              ? isBoost
                ? "⚡🚀"
                : "🎉✨"
              : consequence === "stumble"
              ? "⚠️🏃"
              : consequence === "saved"
              ? "🧤⚽"
              : "💡"}
          </span>
          <div className="text-start">
            <h3 className="text-lg font-black leading-tight">
              {message ?? (isCorrect ? "Jawaban Benar!" : "Belum Tepat!")}
            </h3>
            {isCorrect ? (
              <p className="text-xs font-bold text-emerald-100">
                +{scoreAwarded} Poin {streak > 1 ? `· ${streak}x Beruntun!` : ""}
              </p>
            ) : correctAnswerText ? (
              <p className="text-xs text-rose-100">
                Jawaban benar: <strong className="font-black">{correctAnswerText}</strong>
              </p>
            ) : (
              <p className="text-xs text-rose-100">Jangan menyerah, coba lagi di soal berikutnya!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
