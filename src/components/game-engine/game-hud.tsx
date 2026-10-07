"use client";

import { useEffect, useState } from "react";
import { isSfxMuted, playSfx, setSfxMuted } from "@/lib/game-engine/audio-bridge";
import type { NormalizedGameType } from "@/lib/game-engine/types";

interface GameHudProps {
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
  readonly isCooperative?: boolean;
  readonly isRtl?: boolean;
}

const TYPE_ICONS: Record<NormalizedGameType, string> = {
  runner: "🏃‍♂️",
  matching: "🧩",
  penalty: "⚽",
  anagram: "🔤",
  quiz: "📝",
};

export function GameHud({
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
  isCooperative = false,
  isRtl = false,
}: GameHudProps) {
  const [muted, setMuted] = useState(isSfxMuted());

  useEffect(() => {
    setMuted(isSfxMuted());
  }, []);

  function toggleMute() {
    const next = !muted;
    setSfxMuted(next);
    setMuted(next);
    if (!next) {
      playSfx("click");
    }
  }

  const isLowTime = secondsLeft !== null && secondsLeft !== undefined && secondsLeft <= 5;

  return (
    <header
      className="rounded-[2rem] bg-white/10 p-4 shadow-xl backdrop-blur-md transition sm:p-5"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Game Title & Badges */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-base shadow-sm">
              {TYPE_ICONS[gameType] ?? "🎮"}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
              {gameMode}
            </span>
            {comboMultiplier > 1 && (
              <span className="animate-pulse rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-xs font-black text-slate-950 shadow-md">
                🔥 x{comboMultiplier} COMBO
              </span>
            )}
            {streak >= 3 && (
              <span className="rounded-full bg-emerald-400/90 px-2.5 py-0.5 text-xs font-black text-slate-950 shadow-sm">
                ⚡ {streak} STREAK
              </span>
            )}
          </div>
          <h1 className="mt-1 truncate text-xl font-black text-white sm:text-2xl">
            {gameName}
          </h1>
        </div>

        {/* Action controls & indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio toggle */}
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute SFX" : "Mute SFX"}
            aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg text-white transition hover:bg-white/25 active:scale-95"
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* Question progress */}
          <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center sm:px-4 sm:py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              Soal
            </div>
            <div className="text-sm font-black text-white sm:text-base">
              {Math.min(questionIndex + 1, questionCount)} / {questionCount}
            </div>
          </div>

          {/* Timer pill */}
          {!isCooperative && secondsLeft !== null && secondsLeft !== undefined && (
            <div
              className={`rounded-xl px-3 py-1.5 text-center font-mono font-black tabular-nums transition sm:px-4 sm:py-2 ${
                isLowTime
                  ? "animate-pulse bg-rose-500 text-white shadow-lg shadow-rose-500/50"
                  : "bg-white/20 text-white"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                Waktu
              </div>
              <div className="text-sm sm:text-base">⏱ {secondsLeft}s</div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary bar: Score, Rank & Timer Progress Line */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs text-white/90">
        <div className="flex items-center gap-3">
          <span className="font-bold">
            Skor: <strong className="text-emerald-300">{currentScore}</strong> pts
          </span>
          {rank !== undefined && totalParticipants !== undefined && (
            <span className="font-bold text-white/80">
              Peringkat: <strong className="text-violet-200">#{rank}</strong> dari {totalParticipants}
            </span>
          )}
        </div>

        {!isCooperative && secondsLeft !== null && secondsLeft !== undefined && (
          <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-white/20 sm:block">
            <div
              className={`h-full transition-all duration-300 ${
                isLowTime ? "bg-rose-400" : "bg-emerald-400"
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, (secondsLeft / timeLimitSeconds) * 100))}%`,
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
}
