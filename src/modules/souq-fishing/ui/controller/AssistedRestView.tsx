import React from "react";
import type { TeamState } from "../../engine/types";

export interface AssistedRestViewProps {
  team: TeamState;
  onContinue?: () => void;
}

export function AssistedRestView({ team, onContinue }: AssistedRestViewProps) {
  return (
    <div
      className="flex flex-col h-full w-full justify-between p-4 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="assisted-rest-view"
    >
      {/* Header Info */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl mb-3">
          📚
        </div>
        <h2 className="text-lg font-black text-amber-400">
          Istirahat Belajar ({team.color})
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Tenangkan pikiran sejenak setelah 3 kesalahan beruntun sebelum melanjutkan petualangan.
        </p>
      </div>

      {/* Countdown Timer (Text-based, zero canvas) */}
      <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900 border border-amber-500/30 my-auto">
        <span className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider mb-1">
          Durasi Istirahat
        </span>
        <span className="text-4xl font-black text-amber-300 tracking-tight" data-testid="rest-timer-countdown">
          15s
        </span>
        <span className="text-xs text-slate-400 mt-2 text-center">
          Kesempatan menelaah kembali kosakata bahasa Arab di pasar dan dermaga.
        </span>
      </div>

      {/* Review Box */}
      <div className="flex flex-col p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4 text-xs">
        <span className="font-bold text-slate-300 mb-1">💡 Tips Kosakata:</span>
        <span className="text-slate-400">
          السُّوقُ (Pasar), الْمَقْصَفُ (Kantin), الْمَرْفَأُ (Dermaga), السَّمَكُ (Ikan).
        </span>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onContinue}
        data-testid="continue-button"
        className="flex items-center justify-center w-full py-4 rounded-xl font-bold text-sm bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition-all min-h-[56px]"
      >
        Lanjut Petualangan
      </button>
    </div>
  );
}
