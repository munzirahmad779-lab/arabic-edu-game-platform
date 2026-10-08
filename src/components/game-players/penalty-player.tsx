"use client";

import { useMemo, useState, useEffect } from "react";
import { QuestionAdapter } from "@/lib/game-engine/question-adapters";
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

  const [selectedBallIndex, setSelectedBallIndex] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<"idle" | "kicking" | "goal" | "saved">("idle");
  const [keeperDive, setKeeperDive] = useState<"left" | "right" | "center" | "idle">("idle");
  const [ballTargetCorner, setBallTargetCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctKey, setCorrectKey] = useState<string>(question.correct_option_key || "A");

  useEffect(() => {
    setCorrectKey(question.correct_option_key || "A");
    setSelectedBallIndex(null);
    setOutcome("idle");
    setKeeperDive("idle");
    setSubmitting(false);
    setHasAnswered(false);
  }, [question]);

  async function handleKickBall(index: number) {
    if (submitting || hasAnswered) return;

    const target = penaltyQuestion.targets[index];
    if (!target) return;

    setSelectedBallIndex(index);
    setSubmitting(true);
    setHasAnswered(true);
    setOutcome("kicking");
    playSfx("kick");

    const isCorrect = target.optionKey === correctKey;

    // Determine realistic trajectory and keeper dive
    // Corners for the 4 balls:
    // Ball 0 -> Top Left, Ball 1 -> Top Right, Ball 2 -> Bottom Left, Ball 3 -> Bottom Right
    const corners: Array<"top-left" | "top-right" | "bottom-left" | "bottom-right"> = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];
    const shotCorner = corners[index % corners.length] ?? "top-left";
    setBallTargetCorner(shotCorner);

    if (isCorrect) {
      // Kiper dives to the WRONG side!
      const wrongDives: Record<string, "left" | "right"> = {
        "top-left": "right",
        "bottom-left": "right",
        "top-right": "left",
        "bottom-right": "left",
      };
      setKeeperDive(wrongDives[shotCorner] ?? "right");

      // Wait 350ms for ball flight animation
      setTimeout(() => {
        setOutcome("goal");
        playSfx("goal");
        onGameEvent?.({
          isCorrect: true,
          scoreAwarded: 100,
          comboMultiplier: 2,
          streak: 1,
          consequence: "goal",
          message: "GOOOOL! ⚽🥅 Tendangan Akurat Merobek Gawang!",
        });
      }, 400);

      await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: target.optionId,
        answerText: target.text,
        responseTimeMs: 1400,
      });
    } else {
      // Kiper dives to the SAME side and saves it!
      const saveDives: Record<string, "left" | "right"> = {
        "top-left": "left",
        "bottom-left": "left",
        "top-right": "right",
        "bottom-right": "right",
      };
      setKeeperDive(saveDives[shotCorner] ?? "left");

      // Wait 350ms for ball flight animation
      setTimeout(() => {
        setOutcome("saved");
        playSfx("saved");
        onGameEvent?.({
          isCorrect: false,
          scoreAwarded: 0,
          comboMultiplier: 1,
          streak: 0,
          consequence: "saved",
          message: "DITEPAK KIPER! 🧤❌ Tendangan Berhasil Dihalau!",
        });
      }, 400);

      await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: target.optionId,
        answerText: target.text,
        responseTimeMs: 1400,
      });
    }

    setSubmitting(false);
  }

  // Keyboard shortcut listener for Balls 1-4 / A-D
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (hasAnswered || submitting) return;
      const key = e.key.toUpperCase();
      if (["1", "2", "3", "4"].includes(key)) {
        const idx = Number(key) - 1;
        if (penaltyQuestion.targets[idx]) void handleKickBall(idx);
      } else if (["A", "B", "C", "D"].includes(key)) {
        const idx = penaltyQuestion.targets.findIndex((t) => t.optionKey === key);
        if (idx !== -1) void handleKickBall(idx);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section
      className="space-y-4 rounded-[2.5rem] bg-slate-950 p-4 sm:p-6 shadow-2xl border border-white/10 text-white relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Question Headline Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-5 text-center border border-emerald-500/40 shadow-inner">
        <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
          ⚽ ADU PENALTI: PILIH BOLA YANG TEPAT
        </span>
        <h2 className="mt-2 text-2xl sm:text-4xl font-black leading-relaxed text-white">
          {penaltyQuestion.questionText}
        </h2>
      </div>

      {/* FOOTBALL STADIUM & GOAL ARENA */}
      <div className="relative h-72 sm:h-84 w-full overflow-hidden rounded-3xl bg-gradient-to-b from-sky-950 via-slate-900 to-emerald-900 border-4 border-slate-700 shadow-2xl">
        {/* Stadium Lights & Pitch Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        {/* Realistic Soccer Goal Net Frame */}
        <div className="absolute inset-x-8 top-6 bottom-16 sm:inset-x-16 sm:top-8 sm:bottom-20 rounded-t-2xl border-t-8 border-x-8 border-white bg-slate-950/70 shadow-2xl overflow-hidden">
          {/* Net Texture Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,#ffffff_1px,transparent_1px),linear-gradient(-45deg,#ffffff_1px,transparent_1px)] [background-size:14px_14px] opacity-25" />

          {/* Goal Line & Grass inside Net */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-emerald-800/80 border-t-4 border-white/60" />

          {/* GOALKEEPER (Kiper 🧤🧑‍🦱) */}
          <div
            className={`absolute bottom-3 transition-all duration-300 z-10 flex flex-col items-center ${
              keeperDive === "left"
                ? "left-8 -translate-y-4 -rotate-45 scale-110"
                : keeperDive === "right"
                ? "right-8 -translate-y-4 rotate-45 scale-110"
                : "left-1/2 -translate-x-1/2 animate-bounce"
            }`}
          >
            <div className="text-5xl sm:text-6xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] select-none">
              {outcome === "saved" ? "🧤🤾‍♂️" : outcome === "goal" ? "🤦‍♂️" : "🧤🧍‍♂️"}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900/80 px-2 py-0.5 rounded text-white border border-white/20">
              KIPER
            </span>
          </div>

          {/* IN-FLIGHT / GOAL BALL ANIMATION */}
          {outcome !== "idle" && (
            <div
              className={`absolute text-4xl sm:text-5xl drop-shadow-2xl transition-all duration-300 z-20 ${
                outcome === "kicking"
                  ? "left-1/2 bottom-0 -translate-x-1/2 scale-75"
                  : outcome === "goal"
                  ? ballTargetCorner === "top-left"
                    ? "left-6 top-6 scale-90 rotate-180"
                    : ballTargetCorner === "top-right"
                    ? "right-6 top-6 scale-90 -rotate-180"
                    : ballTargetCorner === "bottom-left"
                    ? "left-6 bottom-4 scale-90"
                    : "right-6 bottom-4 scale-90"
                  : keeperDive === "left"
                  ? "left-12 bottom-6 scale-75"
                  : "right-12 bottom-6 scale-75"
              }`}
            >
              ⚽
            </div>
          )}

          {/* OUTCOME BANNERS OVER NET */}
          {outcome === "goal" && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center animate-in zoom-in-75 duration-200 z-30">
              <span className="text-6xl animate-bounce">⚽🥅🎉</span>
              <h3 className="text-3xl sm:text-5xl font-black text-amber-300 drop-shadow-lg tracking-wider animate-pulse">
                GOOOOOOL!
              </h3>
              <p className="text-sm font-bold text-white mt-1">
                Tendangan Terarah Menembus Gawang! (+100 Poin)
              </p>
            </div>
          )}

          {outcome === "saved" && (
            <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-xs flex flex-col items-center justify-center animate-in zoom-in-75 duration-200 z-30">
              <span className="text-6xl animate-bounce">🧤💥❌</span>
              <h3 className="text-3xl sm:text-5xl font-black text-rose-400 drop-shadow-lg tracking-wider">
                DITEPAK KIPER!
              </h3>
              <p className="text-sm font-bold text-white mt-1">
                Kiper Berhasil Mengantisipasi Tendangan!
              </p>
            </div>
          )}
        </div>

        {/* Penalty Spot Line on Turf */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-emerald-800 to-emerald-700 flex items-center justify-center border-t-4 border-white/50">
          <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_12px_#fff]" />
          <span className="ms-2 text-[10px] font-black uppercase tracking-widest text-white/70">
            TITIK PENALTI (PENALTY SPOT)
          </span>
        </div>
      </div>

      {/* THE 4 FOOTBALLS AT THE PENALTY SPOT (4 BOLA PILIHAN JAWABAN) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
            👉 Pilih Salah Satu Bola untuk Menendang ke Gawang:
          </span>
          <span className="text-xs font-bold text-white/50">
            Tekan [1-4] atau [A-D] di keyboard
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {penaltyQuestion.targets.map((target, idx) => {
            const isSelected = selectedBallIndex === idx;
            const isTargetCorrect = target.optionKey === correctKey;

            let cardTheme = "border-white/20 bg-white/5 hover:border-emerald-400 hover:bg-white/10";
            if (hasAnswered) {
              if (isTargetCorrect) {
                cardTheme = "border-emerald-400 bg-emerald-500/30 text-white shadow-lg shadow-emerald-500/30 scale-102";
              } else if (isSelected) {
                cardTheme = "border-rose-500 bg-rose-500/30 text-white shadow-lg shadow-rose-500/30 opacity-80";
              } else {
                cardTheme = "border-white/5 bg-white/5 opacity-40";
              }
            }

            return (
              <button
                key={target.optionId}
                type="button"
                disabled={submitting || hasAnswered}
                onClick={() => void handleKickBall(idx)}
                className={`group flex flex-col items-center justify-between rounded-3xl p-4 text-center transition-all duration-200 border-2 active:scale-95 cursor-pointer ${cardTheme}`}
              >
                {/* 3D Football Icon with Badge */}
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-white to-slate-300 text-3xl shadow-xl border-2 border-slate-900 group-hover:scale-110 group-hover:-translate-y-1 transition duration-200">
                    ⚽
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-slate-950 border-2 border-slate-900 shadow">
                    {target.optionKey}
                  </span>
                </div>

                {/* Option Text in Arabic & Romanized */}
                <div className="mt-3 w-full">
                  <p className="font-arabic text-xl sm:text-2xl font-bold text-white leading-relaxed" dir="rtl">
                    {target.text}
                  </p>
                  <span className="mt-1 inline-block text-[10px] font-mono uppercase tracking-wider text-emerald-300/80">
                    Bola #{idx + 1}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
