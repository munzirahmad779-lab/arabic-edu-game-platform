import React from "react";
import type { TeamState, GateId } from "../../engine/types";
import { GATE_CONFIG } from "../../engine/gates";

export interface QuestionOption {
  id: string;
  text: string;
  label?: string; // "A", "B", "C", "D"
}

export interface QuestionData {
  id: string;
  text: string;
  options: readonly QuestionOption[];
}

export interface GateChallengeCardProps {
  team: TeamState;
  question?: QuestionData;
}

const DEFAULT_QUESTION: QuestionData = {
  id: "q-default-gate",
  text: "مَا مَعْنَى كَلِمَةِ «السُّوْقُ» فِي اللُّغَةِ الْعَرَبِيَّةِ؟",
  options: [
    { id: "opt-a", label: "A", text: "Pasar / Tempat Jual Beli" },
    { id: "opt-b", label: "B", text: "Masjid / Tempat Ibadah" },
    { id: "opt-c", label: "C", text: "Dermaga / Tempat Kapal" },
    { id: "opt-d", label: "D", text: "Kantin / Tempat Makan" },
  ],
};

export function GateChallengeCard({
  team,
  question = DEFAULT_QUESTION,
}: GateChallengeCardProps) {
  const currentGateId: GateId =
    team.location === "GERBANG_KANTIN" ? "GERBANG_KANTIN" : "KIOS";
  const config = GATE_CONFIG[currentGateId];
  const totalPins = config.requiredPins;
  const unlockedPins = Math.min(totalPins, team.pinsUnlocked);

  // Assistance 50:50: if consecutiveWrong >= 2, hide/disable the 4th option
  const isHideOptionActive = team.consecutiveWrong >= 2;

  return (
    <div
      className="flex flex-col h-full w-full justify-between p-2 rounded bg-slate-800/80 border border-amber-500/30 overflow-hidden"
      data-testid="gate-challenge-card"
    >
      {/* Header: Gembok Emas + Pins */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1 mb-1">
        <div className="flex items-center space-x-1.5">
          <span className="text-base" role="img" aria-label="Gembok Emas">
            🔒
          </span>
          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
            {currentGateId === "KIOS" ? "Gerbang 1: Kios" : "Gerbang 2: Kantin"}
          </span>
        </div>
        {/* Pin progress indicators */}
        <div className="flex items-center space-x-1" data-testid="gate-pins">
          {Array.from({ length: totalPins }).map((_, i) => (
            <span
              key={i}
              className="text-xs"
              title={i < unlockedPins ? "Pin Terbuka" : "Pin Terkunci"}
            >
              {i < unlockedPins ? "🔓" : "🔒"}
            </span>
          ))}
        </div>
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
        {question.options.map((opt, idx) => {
          const isHiddenByAssistance = isHideOptionActive && idx === 3;
          return (
            <div
              key={opt.id}
              className={`flex items-center px-2 py-1.5 rounded text-left border transition-colors ${
                isHiddenByAssistance
                  ? "opacity-25 bg-slate-900 border-slate-700 text-slate-500 line-through"
                  : "bg-slate-700/60 border-slate-600/60 text-slate-200 hover:border-amber-400/50"
              }`}
              style={{ fontSize: "clamp(0.65rem, 0.95vw, 1rem)" }}
              data-testid={`option-${opt.id}`}
            >
              <span className="font-bold mr-1.5 text-amber-400">
                {opt.label ?? String.fromCharCode(65 + idx)}.
              </span>
              <span className="truncate">{opt.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
