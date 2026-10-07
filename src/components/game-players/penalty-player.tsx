"use client";

import { useMemo, useState } from "react";
import { QuestionAdapter, type PenaltyTarget } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

export function PenaltyPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const penaltyQuestion = useMemo(
    () => QuestionAdapter.toPenalty(question),
    [question],
  );

  const [shotTarget, setShotTarget] = useState<PenaltyTarget | null>(null);
  const [outcome, setOutcome] = useState<"idle" | "shooting" | "goal" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  async function handleShoot(target: PenaltyTarget) {
    if (submitting || hasAnswered) return;

    setShotTarget(target);
    setOutcome("shooting");
    setSubmitting(true);
    setHasAnswered(true);
    playSfx("click");

    const result = await onSubmitAnswer({
      questionId: question.id,
      selectedOptionId: target.optionId,
      answerText: null,
      responseTimeMs: 1800,
    });

    if (result.isCorrect) {
      setOutcome("goal");
      playSfx("goal");
      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: result.scoreAwarded ?? 100,
        comboMultiplier: 2,
        streak: 1,
        consequence: "goal",
        message: "GOAAAL! Tembakan Akurat Merobek Gawang! ⚽🥅",
      });
    } else {
      setOutcome("saved");
      playSfx("saved");
      onGameEvent?.({
        isCorrect: false,
        scoreAwarded: 0,
        comboMultiplier: 1,
        streak: 0,
        consequence: "saved",
        message: "Tepisan Kiper! Tendangan Berhasil Dihalau 🧤⚽",
      });
    }

    setSubmitting(false);
  }

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Stadium Pitch Atmosphere Banner */}
      <div className="flex items-center justify-between text-xs font-bold text-amber-300">
        <div className="flex items-center gap-2">
          <span>🏟️ Titik Penalti</span>
        </div>
        <div className="text-white/60">
          Pilih sudut gawang dengan jawaban yang benar untuk menembak!
        </div>
      </div>

      {/* Question Challenge Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-emerald-950 p-5 text-center border border-amber-500/30">
        <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
          Tantangan Tendangan Penalti
        </span>
        <h2 className="mt-2 text-2xl font-black leading-relaxed text-white sm:text-3xl">
          {penaltyQuestion.questionText}
        </h2>
      </div>

      {/* Goal Post & Penalty Shootout Arena */}
      <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-950 via-emerald-950 to-emerald-900 p-4 border-4 border-slate-300 shadow-2xl">
        {/* Goal Net Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />

        {/* Goalkeeper in Goal Post */}
        <div className="absolute inset-x-0 bottom-12 flex justify-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full text-5xl transition-all duration-300 ${
              outcome === "goal"
                ? "translate-x-24 opacity-60 rotate-45 scale-90"
                : outcome === "saved"
                ? "scale-125 -translate-y-4 shadow-2xl"
                : "animate-bounce"
            }`}
          >
            {outcome === "saved" ? "🧤" : "🧍‍♂️"}
          </div>
        </div>

        {/* Goal Targets in Net Corners */}
        <div className="relative z-10 grid h-full grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
          {penaltyQuestion.targets.map((target, idx) => {
            const isSelected = shotTarget?.optionId === target.optionId;
            return (
              <button
                key={target.optionId}
                type="button"
                disabled={submitting || hasAnswered}
                onClick={() => void handleShoot(target)}
                className={`group flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-200 border-2 active:scale-95 ${
                  isSelected
                    ? outcome === "goal"
                      ? "border-emerald-400 bg-emerald-500/40 shadow-xl shadow-emerald-500/50 scale-105"
                      : "border-rose-400 bg-rose-500/40 shadow-xl shadow-rose-500/50 scale-95"
                    : "border-white/30 bg-black/40 hover:border-amber-400 hover:bg-amber-500/20"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-slate-950 shadow">
                  {target.optionKey}
                </span>
                <span className="mt-1.5 line-clamp-2 text-sm font-black text-white group-hover:text-amber-200">
                  {target.text}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                  🎯 Sudut #{idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Animated Football Ball */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
          <div
            className={`text-4xl transition-all duration-300 ${
              outcome === "shooting" || outcome === "goal"
                ? "-translate-y-36 scale-75"
                : outcome === "saved"
                ? "-translate-y-20 scale-90"
                : ""
            }`}
          >
            ⚽
          </div>
        </div>
      </div>
    </section>
  );
}
