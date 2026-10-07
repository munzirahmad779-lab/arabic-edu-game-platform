"use client";

import type { ReactNode } from "react";
import { GameHud } from "./game-hud";
import { GameFeedback } from "./game-feedback";
import type { ConsequenceType, NormalizedGameType } from "@/lib/game-engine/types";

interface GameShellProps {
  readonly gameName: string;
  readonly gameType: NormalizedGameType;
  readonly gameMode: string;
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly currentScore?: number;
  readonly rank?: number;
  readonly totalParticipants?: number;
  readonly streak?: number;
  readonly comboMultiplier?: number;
  readonly secondsLeft?: number | null;
  readonly timeLimitSeconds?: number;
  readonly countdown?: number | null;
  readonly isCooperative?: boolean;
  readonly isRtl?: boolean;
  readonly answerSubmitted?: boolean;
  readonly submitError?: string | null;
  readonly feedback?: {
    readonly isVisible: boolean;
    readonly isCorrect: boolean;
    readonly consequence: ConsequenceType;
    readonly scoreAwarded?: number;
    readonly streak?: number;
    readonly message?: string;
    readonly correctAnswerText?: string;
  };
  readonly children: ReactNode;
}

const BG_GRADIENTS: Record<NormalizedGameType, string> = {
  runner: "from-emerald-800 via-teal-900 to-slate-950",
  matching: "from-indigo-800 via-slate-900 to-violet-950",
  penalty: "from-amber-800 via-stone-900 to-emerald-950",
  anagram: "from-violet-800 via-purple-900 to-slate-950",
  quiz: "from-violet-700 via-indigo-800 to-sky-900",
};

export function GameShell({
  gameName,
  gameType,
  gameMode,
  questionIndex,
  questionCount,
  currentScore = 0,
  rank,
  totalParticipants,
  streak = 0,
  comboMultiplier = 1,
  secondsLeft,
  timeLimitSeconds = 20,
  countdown = null,
  isCooperative = false,
  isRtl = false,
  answerSubmitted = false,
  submitError = null,
  feedback,
  children,
}: GameShellProps) {
  const gradient = BG_GRADIENTS[gameType] ?? BG_GRADIENTS.quiz;

  return (
    <main
      className={`min-h-screen bg-gradient-to-br ${gradient} p-3 sm:p-5 text-white transition-colors duration-500`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Reusable HUD */}
        <GameHud
          gameName={gameName}
          gameType={gameType}
          gameMode={gameMode}
          questionIndex={questionIndex}
          questionCount={questionCount}
          currentScore={currentScore}
          rank={rank}
          totalParticipants={totalParticipants}
          streak={streak}
          comboMultiplier={comboMultiplier}
          secondsLeft={secondsLeft}
          timeLimitSeconds={timeLimitSeconds}
          isCooperative={isCooperative}
          isRtl={isRtl}
        />

        {/* Global Feedback Overlay */}
        {feedback && (
          <GameFeedback
            isVisible={feedback.isVisible}
            isCorrect={feedback.isCorrect}
            consequence={feedback.consequence}
            scoreAwarded={feedback.scoreAwarded}
            streak={feedback.streak}
            message={feedback.message}
            correctAnswerText={feedback.correctAnswerText}
          />
        )}

        {/* Countdown Stage */}
        {countdown !== null && countdown > 0 ? (
          <section
            aria-live="assertive"
            className="rounded-[2rem] bg-white/10 p-12 text-center shadow-2xl backdrop-blur-md"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-white/70">
              Bersiaplah...
            </p>
            <div className="mt-4 text-8xl font-black tabular-nums tracking-tighter text-white animate-pulse">
              {countdown}
            </div>
            <p className="mt-4 text-sm text-white/80">
              Pertanyaan berikutnya segera dimulai!
            </p>
          </section>
        ) : (
          /* Active Gameplay Player */
          <div className="transition-opacity duration-300">
            {children}

            {answerSubmitted && (
              <div className="mt-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 p-3.5 text-center font-black text-emerald-200">
                ✓ Jawaban tercatat — menunggu giliran/soal berikutnya...
              </div>
            )}

            {submitError && (
              <div className="mt-4 rounded-2xl bg-rose-500/20 border border-rose-400/40 p-3.5 text-center font-bold text-rose-200">
                ⚠️ {submitError}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
