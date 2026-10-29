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
  kahoot: "▲",
  millionaire: "💰",
  jeopardy: "📋",
  memory_card: "🃏",
  wordle: "🟩",
  scramble: "🔤",
  hangman: "⛄",
  wheel_fortune: "🎡",
  whack_mole: "🔨",
  matching_column: "↔️",
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

  const pillLabel =
    "text-[10px] font-bold uppercase tracking-wider text-white/70";
  const pillValue = "text-sm font-black text-white sm:text-base";

  return (
    <header
      data-testid="hud-header"
      className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-xl backdrop-blur-md transition sm:p-5"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Baris 1: chip mode & tombol suara */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-base shadow-sm">
            {TYPE_ICONS[gameType] ?? "🎮"}
          </span>
          <span
            data-testid="hud-chip-mode"
            className="rounded-full bg-terracotta-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white"
          >
            {gameMode}
          </span>
          {comboMultiplier > 1 && (
            <span className="animate-pulse rounded-full bg-gradient-to-r from-terracotta-500 to-terracotta-600 px-2.5 py-0.5 text-xs font-black text-white shadow-md">
              🔥 x{comboMultiplier} COMBO
            </span>
          )}
          {streak >= 3 && (
            <span className="rounded-full bg-emerald-400/90 px-2.5 py-0.5 text-xs font-black text-slate-950 shadow-sm">
              ⚡ {streak} STREAK
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleMute}
          title={muted ? "Unmute SFX" : "Mute SFX"}
          aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg text-white transition hover:bg-white/25 active:scale-95"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Baris 2: judul game */}
      <h1
        data-testid="hud-title"
        className="mt-2.5 truncate text-xl font-black text-white sm:text-2xl"
      >
        {gameName}
      </h1>

      {/* Baris 3: indikator soal, waktu, skor & peringkat (baris sendiri,
          berjarak konsisten, boleh membungkus rapi di layar sempit) */}
      <div
        data-testid="hud-indicators"
        className="mt-3 flex flex-wrap items-stretch gap-2"
      >
        <div
          data-testid="hud-pill-soal"
          className="rounded-xl bg-white/15 px-3 py-1.5 text-center sm:px-4 sm:py-2"
        >
          <div className={pillLabel}>Soal</div>
          <div className={pillValue}>
            {Math.min(questionIndex + 1, questionCount)} / {questionCount}
          </div>
        </div>

        {!isCooperative && secondsLeft !== null && secondsLeft !== undefined && (
          <div
            data-testid="hud-pill-waktu"
            className={`rounded-xl px-3 py-1.5 text-center tabular-nums transition sm:px-4 sm:py-2 ${
              isLowTime
                ? "animate-pulse bg-rose-500 text-white shadow-lg shadow-rose-500/50"
                : "bg-white/15 text-white"
            }`}
          >
            <div className={pillLabel}>Waktu</div>
            <div className={`${pillValue} font-mono`}>⏱ {secondsLeft}s</div>
          </div>
        )}

        <div
          data-testid="hud-pill-skor"
          className="rounded-xl bg-white/15 px-3 py-1.5 text-center sm:px-4 sm:py-2"
        >
          <div className={pillLabel}>Skor</div>
          <div className={pillValue}>
            <strong className="text-emerald-300">{currentScore}</strong> pts
          </div>
        </div>

        {rank !== undefined && totalParticipants !== undefined && (
          <div
            data-testid="hud-pill-rank"
            className="rounded-xl bg-white/15 px-3 py-1.5 text-center sm:px-4 sm:py-2"
          >
            <div className={pillLabel}>Peringkat</div>
            <div className={pillValue}>
              #{rank}{" "}
              <span className="text-xs font-bold text-white/70">
                dari {totalParticipants}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Baris 4: garis progres waktu */}
      {!isCooperative && secondsLeft !== null && secondsLeft !== undefined && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
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
    </header>
  );
}
