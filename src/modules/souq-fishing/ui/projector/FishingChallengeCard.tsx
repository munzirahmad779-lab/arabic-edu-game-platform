import React from "react";
import type { TeamState, FishTier } from "../../engine/types";
import type { QuestionData } from "./GateChallengeCard";

export interface FishingChallengeCardProps {
  team: TeamState;
  question?: QuestionData;
}

const DEFAULT_FISHING_QUESTION: QuestionData = {
  id: "q-default-fishing",
  text: "مَا هُوَ حَرْفُ الْجَرِّ فِي هَذِهِ الْجُمْلَةِ: «اصْطَادَ فِي الْبَحْرِ»؟",
  options: [
    { id: "opt-1", label: "A", text: "فِي (Di / Di dalam)" },
    { id: "opt-2", label: "B", text: "اصْطَادَ (Memancing)" },
    { id: "opt-3", label: "C", text: "الْبَحْرِ (Laut)" },
    { id: "opt-4", label: "D", text: "هُوَ (Dia)" },
  ],
};

const TIER_COLORS: Record<FishTier, { bg: string; text: string; badge: string }> = {
  COMMON: { bg: "bg-emerald-950/40", text: "text-emerald-400", badge: "Common {50, 75, 100}" },
  RARE: { bg: "bg-blue-950/40", text: "text-blue-400", badge: "Rare {200, 250, 300} (20s)" },
  EPIC: { bg: "bg-purple-950/40", text: "text-purple-400", badge: "Epic {450-600} (2 Soal)" },
  LEGENDARY: { bg: "bg-amber-950/40", text: "text-amber-400", badge: "Legendary {800-1200} (3 Soal)" },
};

export function FishingChallengeCard({
  team,
  question = DEFAULT_FISHING_QUESTION,
}: FishingChallengeCardProps) {
  const currentQ = team.currentQuestion;
  const tier: FishTier =
    currentQ && "tier" in currentQ && currentQ.tier ? currentQ.tier : "COMMON";
  const targetPoints =
    currentQ && "targetPoints" in currentQ && currentQ.targetPoints
      ? currentQ.targetPoints
      : 75;

  const tierMeta = TIER_COLORS[tier];
  const isBuffActive = team.buffsActive.canteenBuffUntilMs > 0;

  // Chain progression
  const chain = team.chainProgress;
  const isChain = chain && chain.targetLength > 1;

  return (
    <div
      className={`flex flex-col h-full w-full justify-between p-2 rounded ${tierMeta.bg} border border-teal-500/30 overflow-hidden`}
      data-testid="fishing-challenge-card"
    >
      {/* Header: Tier, Ribbon Poin, Timer / Chain */}
      <div className="flex items-center justify-between border-b border-teal-500/20 pb-1 mb-1">
        <div className="flex items-center space-x-1.5">
          {/* Jumping Fish SVG (<1 KB) */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-teal-400"
          >
            <path
              d="M12 4C7 4 3 8 2 12C3 16 7 20 12 20C15 20 18 18 20 16L22 18L21 12L22 6L20 8C18 6 15 4 12 4Z"
              fill="currentColor"
              opacity="0.85"
            />
            <circle cx="6" cy="11" r="1.5" fill="#0f172a" />
          </svg>
          <span className={`text-xs font-bold uppercase tracking-wider ${tierMeta.text}`}>
            {tier}
          </span>
        </div>

        {/* Pita Poin */}
        <div className="flex items-center space-x-1.5">
          {isChain && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40 font-semibold">
              Rantai: {chain.correctCount + 1}/{chain.targetLength}
            </span>
          )}
          {tier === "RARE" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-500/40 font-mono font-bold">
              ⏱ 20s
            </span>
          )}
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {`+${targetPoints} Poin`} {isBuffActive && <span className="text-[10px] text-emerald-300">(+20% Buff)</span>}
          </span>
        </div>
      </div>

      {/* Tension Bar (CSS Progress Bar, No Canvas) */}
      <div className="w-full bg-slate-900/80 rounded-full h-1.5 mb-1 overflow-hidden border border-teal-500/20">
        <div
          className="bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400 h-full rounded-full transition-all duration-300"
          style={{ width: "65%" }}
          title="Tension Bar (Kekuatan Tarikan Senar)"
        />
      </div>

      {/* Question Text */}
      <div
        className="my-auto text-slate-100 font-medium text-center px-1"
        dir="auto"
        style={{
          fontSize: "clamp(0.75rem, 1.2vw, 1.5rem)",
          lineHeight: 1.95,
        }}
      >
        {question.text}
      </div>

      {/* 4 Options Grid (2x2) */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {question.options.map((opt, idx) => (
          <div
            key={opt.id}
            className="flex items-center px-2 py-1.5 rounded text-left border bg-slate-700/60 border-slate-600/60 text-slate-200 hover:border-teal-400/50 transition-colors"
            style={{ fontSize: "clamp(0.65rem, 0.95vw, 1rem)" }}
            data-testid={`fishing-option-${opt.id}`}
          >
            <span className="font-bold mr-1.5 text-teal-400">
              {opt.label ?? String.fromCharCode(65 + idx)}.
            </span>
            <span className="truncate">{opt.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
