import React from "react";
import type { TeamState, TeamColor } from "../../engine/types";
import { ALL_TEAM_COLORS } from "../../engine/world";
import { CharacterPicker, type CharacterId } from "./CharacterPicker";

export interface PreGameDashboardProps {
  team: TeamState;
  onAction?: (action: string, payload?: unknown) => void;
}

const TEAM_CONFIG: Record<
  TeamColor,
  { name: string; bg: string; activeBorder: string; badge: string }
> = {
  MERAH: {
    name: "Tim Merah",
    bg: "bg-red-950/40",
    activeBorder: "border-red-500",
    badge: "bg-red-600 text-white",
  },
  BIRU: {
    name: "Tim Biru",
    bg: "bg-blue-950/40",
    activeBorder: "border-blue-500",
    badge: "bg-blue-600 text-white",
  },
  KUNING: {
    name: "Tim Kuning",
    bg: "bg-amber-950/40",
    activeBorder: "border-amber-500",
    badge: "bg-amber-500 text-slate-950",
  },
  HIJAU: {
    name: "Tim Hijau",
    bg: "bg-emerald-950/40",
    activeBorder: "border-emerald-500",
    badge: "bg-emerald-600 text-white",
  },
};

export function PreGameDashboard({ team, onAction }: PreGameDashboardProps) {
  const handleSelectCharacter = (characterId: CharacterId) => {
    onAction?.("selectCharacter", { characterId });
  };

  const handleSelectTeam = (color: TeamColor) => {
    onAction?.("selectTeam", { color });
  };

  return (
    <div
      className="flex flex-col h-full w-full justify-between p-4 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="pre-game-dashboard"
    >
      {/* Header */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <span className="text-2xl mb-1" role="img" aria-label="Lobi Game">
          🕌
        </span>
        <h1 className="text-lg font-black tracking-wide text-amber-400">
          Ekspedisi Pasar & Dermaga
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Pilih Karakter & Tim Sebelum Memulai
        </p>
      </div>

      {/* Section 1: Karakter */}
      <div className="flex flex-col space-y-2 mb-4">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Pilih Karakter
        </label>
        <CharacterPicker
          selectedCharacter={team.characterId}
          onSelect={handleSelectCharacter}
        />
      </div>

      {/* Section 2: Tim */}
      <div className="flex flex-col space-y-2 mb-4">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Pilih Tim
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {ALL_TEAM_COLORS.map((color) => {
            const cfg = TEAM_CONFIG[color];
            const isSelected = team.color === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => handleSelectTeam(color)}
                data-testid={`team-button-${color.toLowerCase()}`}
                className={`flex items-center justify-between px-3 py-3 rounded-xl border-2 transition-all min-h-[56px] ${
                  isSelected
                    ? `${cfg.activeBorder} ${cfg.bg} ring-2 ring-amber-400/30`
                    : "border-slate-800 bg-slate-900/40 opacity-70 hover:opacity-100"
                }`}
              >
                <span className="text-xs font-bold text-white">{cfg.name}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}
                >
                  {isSelected ? "Aktif" : "Pilih"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer: Status Lobi */}
      <div className="flex flex-col items-center pt-2 pb-4 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Menunggu Guru Memulai Sesi...</span>
        </div>
      </div>
    </div>
  );
}
