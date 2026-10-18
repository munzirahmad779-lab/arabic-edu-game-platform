import React from "react";
import type { TeamState, FishTier } from "../../engine/types";
import type { QuestionData } from "../projector/GateChallengeCard";

export interface FishingQuestionViewProps {
  team: TeamState;
  question?: QuestionData;
  onAction?: (action: string, payload?: unknown) => void;
  onSelectOption?: (optionId: string) => void;
}

const DEFAULT_FISHING_QUESTION: QuestionData = {
  id: "q-default-fishing",
  text: "مَا مَعْنَى كَلِمَةِ «السَّمَك»؟ (Apa arti kata 'As-Samak'?)",
  options: [
    { id: "opt-1", label: "A", text: "Ikan" },
    { id: "opt-2", label: "B", text: "Perahu" },
    { id: "opt-3", label: "C", text: "Laut" },
    { id: "opt-4", label: "D", text: "Kail" },
  ],
};

const DEFAULT_LABELS = ["A", "B", "C", "D"] as const;

const TIER_META: Record<
  FishTier,
  { name: string; bg: string; text: string; defaultPoints: number }
> = {
  COMMON: {
    name: "Ikan Biasa (Common)",
    bg: "bg-emerald-950/40 border-emerald-500/40",
    text: "text-emerald-400",
    defaultPoints: 75,
  },
  RARE: {
    name: "Ikan Langka (Rare)",
    bg: "bg-blue-950/40 border-blue-500/40",
    text: "text-blue-400",
    defaultPoints: 250,
  },
  EPIC: {
    name: "Ikan Epik (Epic)",
    bg: "bg-purple-950/40 border-purple-500/40",
    text: "text-purple-400",
    defaultPoints: 500,
  },
  LEGENDARY: {
    name: "Ikan Legendaris",
    bg: "bg-amber-950/40 border-amber-500/40",
    text: "text-amber-400",
    defaultPoints: 1000,
  },
};

export function FishingQuestionView({
  team,
  question = DEFAULT_FISHING_QUESTION,
  onAction,
  onSelectOption,
}: FishingQuestionViewProps) {
  const isHooked = team.status === "IN_FISHING_QUESTION";

  // Tier metadata
  const currentQ = team.currentQuestion;
  const tier: FishTier =
    currentQ && "tier" in currentQ && currentQ.tier
      ? currentQ.tier
      : "COMMON";
  const points =
    currentQ && "targetPoints" in currentQ && currentQ.targetPoints
      ? currentQ.targetPoints
      : TIER_META[tier].defaultPoints;

  const meta = TIER_META[tier];
  const isRareTier = tier === "RARE";
  const chain = team.chainProgress;
  const isChain = chain && chain.targetLength > 1;

  // Idle state: Kail belum dilempar
  if (!isHooked) {
    return (
      <div
        className="flex flex-col h-full w-full justify-between p-4 bg-slate-950 text-slate-100 overflow-y-auto"
        data-testid="fishing-question-view-idle"
      >
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-20 h-20 rounded-full bg-sky-950/60 border border-sky-500/30 flex items-center justify-center mb-3 text-3xl">
            🎣
          </div>
          <h2 className="text-base font-bold text-sky-400">
            Dermaga Pancing Siap
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Lempar kail ke perairan untuk memancing ikan dan tantangan kosakata
            Bahasa Arab.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAction?.("castLine")}
          data-testid="cast-line-button"
          className="flex items-center justify-center w-full py-4 rounded-xl font-bold text-base bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98] shadow-lg shadow-amber-500/20 transition-all min-h-[56px]"
        >
          🎣 Lempar Kail Sekarang
        </button>
      </div>
    );
  }

  // Hooked state: Pertanyaan pancing aktif
  return (
    <div
      className="flex flex-col h-full w-full justify-between p-4 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="fishing-question-view-hooked"
    >
      {/* Header: Status Ikan & Pita Poin */}
      <div
        className={`flex flex-col p-3 rounded-xl border ${meta.bg} mb-2.5`}
        data-testid="fishing-header"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-2">
            {/* SVG Ikan Melompat (<2 KB) */}
            <svg
              className="w-8 h-8 text-sky-400 animate-bounce shrink-0"
              viewBox="0 0 32 32"
              fill="none"
              data-testid="jumping-fish-svg"
            >
              <path
                d="M4 16C8 10 18 8 26 13C24 18 20 22 14 22C8 22 5 18 4 16Z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                d="M26 13L30 8M26 13L30 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="9" cy="15" r="1.5" fill="#020617" />
              <path
                d="M15 11C17 9 20 9 21 11"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <span className={`text-xs font-black ${meta.text}`}>
                {meta.name}
              </span>
              {isChain && (
                <div className="text-[10px] text-purple-300 font-semibold">
                  Rantai Soal {chain.correctCount + 1}/{chain.targetLength}
                </div>
              )}
            </div>
          </div>

          {/* Pita Poin */}
          <div
            className="flex items-center px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs"
            data-testid="point-ribbon"
          >
            {`+${points} Poin`}
          </div>
        </div>

        {/* CSS Tension Bar */}
        <div className="w-full flex flex-col space-y-1 mt-1" data-testid="tension-bar">
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>Tegangan Senar</span>
            <span>65%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 rounded-full transition-all duration-300"
              style={{ width: "65%" }}
            />
          </div>
        </div>

        {/* Timer 20s untuk Rare Tier */}
        {isRareTier && (
          <div
            className="flex items-center justify-center space-x-1 mt-2 py-1 px-2 rounded bg-blue-900/40 border border-blue-500/30 text-blue-300 text-xs font-bold"
            data-testid="rare-timer"
          >
            <span role="img" aria-label="Timer">
              ⏱️
            </span>
            <span>Timer Soal: 20 Detik</span>
          </div>
        )}
      </div>

      {/* Soal Pancing */}
      <div className="flex flex-col p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-3 flex-1 justify-center">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Pertanyaan Tarik Ikan
        </span>
        <p
          className="text-base font-bold text-sky-200 leading-relaxed"
          dir="auto"
          data-testid="question-text"
        >
          {question.text}
        </p>
      </div>

      {/* 4 Opsi Jawaban (Tap target >= 56px) */}
      <div className="flex flex-col space-y-2">
        {question.options.map((opt, idx) => {
          const label = opt.label || DEFAULT_LABELS[idx] || "A";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectOption?.(opt.id)}
              data-testid={`option-${label.toLowerCase()}`}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-sky-400/60 hover:bg-slate-800/80 active:scale-[0.98] transition-all min-h-[56px] text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm shrink-0 border border-sky-500/30">
                {label}
              </span>
              <span
                className="text-sm font-medium text-slate-200 flex-1 leading-snug"
                dir="auto"
              >
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
