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

// Tema Opsi C: satu latar teal tua brand Magguru untuk semua tipe game di
// room siswa (teal-700 #1F4A4E -> teal-600 #255759 -> teal-500 #2F6D72).
const BRAND_GRADIENT = "from-teal-700 via-teal-600 to-teal-500";

const BG_GRADIENTS: Record<NormalizedGameType, string> = {
  runner: BRAND_GRADIENT,
  matching: BRAND_GRADIENT,
  penalty: BRAND_GRADIENT,
  anagram: BRAND_GRADIENT,
  quiz: BRAND_GRADIENT,
  kahoot: BRAND_GRADIENT,
  millionaire: BRAND_GRADIENT,
  jeopardy: BRAND_GRADIENT,
  memory_card: BRAND_GRADIENT,
  wordle: BRAND_GRADIENT,
  scramble: BRAND_GRADIENT,
  hangman: BRAND_GRADIENT,
  wheel_fortune: BRAND_GRADIENT,
  whack_mole: BRAND_GRADIENT,
  matching_column: BRAND_GRADIENT,
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
