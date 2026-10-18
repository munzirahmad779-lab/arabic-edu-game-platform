import React from "react";
import type { TeamState, GateId } from "../../engine/types";
import { GATE_CONFIG } from "../../engine/gates";
import type { QuestionData } from "../projector/GateChallengeCard";

export interface GateQuestionViewProps {
  team: TeamState;
  question?: QuestionData;
  onSelectOption?: (optionId: string) => void;
}

const DEFAULT_QUESTION: QuestionData = {
  id: "q-default-gate",
  text: "مَا هَٰذَا الْمَكَانُ؟ (Apakah tempat ini?)",
  options: [
    { id: "opt-a", label: "A", text: "السُّوقُ (Pasar)" },
    { id: "opt-b", label: "B", text: "الْمَسْجِدُ (Masjid)" },
    { id: "opt-c", label: "C", text: "الْمَرْفَأُ (Dermaga)" },
    { id: "opt-d", label: "D", text: "الْمَقْصَفُ (Kantin)" },
  ],
};

const DEFAULT_LABELS = ["A", "B", "C", "D"] as const;

export function GateQuestionView({
  team,
  question = DEFAULT_QUESTION,
  onSelectOption,
}: GateQuestionViewProps) {
  const currentGateId: GateId =
    team.location === "GERBANG_KANTIN" ? "GERBANG_KANTIN" : "KIOS";
  const config = GATE_CONFIG[currentGateId];
  const totalPins = config.requiredPins;
  const unlockedPins = Math.min(totalPins, team.pinsUnlocked);

  // Assistance 50:50: if consecutiveWrong >= 2, hide the 4th option
  const isHideOptionActive = team.consecutiveWrong >= 2;

  return (
    <div
      className="flex flex-col h-full w-full justify-between p-4 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="gate-question-view"
    >
      {/* Header: Gembok Emas & Pins */}
      <div className="flex flex-col p-3 rounded-xl bg-slate-900 border border-amber-500/40 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xl" role="img" aria-label="Gembok Emas">
              🔐
            </span>
            <span className="text-sm font-bold text-amber-400">
              {currentGateId === "GERBANG_KANTIN"
                ? "Gembok Gerbang Kantin"
                : "Gembok Kios Pasar"}
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
            {`${unlockedPins} / ${totalPins} Pin`}
          </span>
        </div>

        {/* Dynamic Pin Indicator Icons [🔓][🔓][🔒][🔒] */}
        <div
          className="flex items-center space-x-2 justify-center py-1 bg-slate-950/60 rounded-lg"
          data-testid="pin-indicators"
        >
          {Array.from({ length: totalPins }).map((_, i) => {
            const isUnlocked = i < unlockedPins;
            return (
              <span
                key={i}
                data-testid={`pin-${i}-${isUnlocked ? "unlocked" : "locked"}`}
                className="text-lg"
                role="img"
                aria-label={isUnlocked ? "Pin Terbuka" : "Pin Terkunci"}
              >
                {isUnlocked ? "🔓" : "🔒"}
              </span>
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      <div className="flex flex-col p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-3 flex-1 justify-center">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Pertanyaan Pembuka Gembok
        </span>
        <p
          className="text-base font-bold text-amber-200 leading-relaxed"
          dir="auto"
          data-testid="question-text"
        >
          {question.text}
        </p>
      </div>

      {/* Options A-D (Tap target >= 56px) */}
      <div className="flex flex-col space-y-2.5">
        {question.options.map((opt, idx) => {
          if (isHideOptionActive && idx === 3) {
            return null; // 50:50 assistance hides option
          }
          const label = opt.label || DEFAULT_LABELS[idx] || "A";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectOption?.(opt.id)}
              data-testid={`option-${label.toLowerCase()}`}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-amber-400/60 hover:bg-slate-800/80 active:scale-[0.98] transition-all min-h-[56px] text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm shrink-0 border border-amber-500/30">
                {label}
              </span>
              <span className="text-sm font-medium text-slate-200 flex-1 leading-snug" dir="auto">
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
