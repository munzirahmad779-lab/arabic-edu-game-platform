import React from "react";
import type { TeamState, TeamColor } from "../../engine/types";
import { GateChallengeCard } from "./GateChallengeCard";
import { FishingChallengeCard } from "./FishingChallengeCard";

export interface TeamBoxProps {
  team: TeamState;
  widthPercent: number;
}

const TEAM_THEMES: Record<
  TeamColor,
  { name: string; border: string; bg: string; badge: string; text: string }
> = {
  MERAH: {
    name: "Tim Merah",
    border: "border-red-600/50",
    bg: "bg-red-950/20",
    badge: "bg-red-600 text-white",
    text: "text-red-400",
  },
  BIRU: {
    name: "Tim Biru",
    border: "border-blue-600/50",
    bg: "bg-blue-950/20",
    badge: "bg-blue-600 text-white",
    text: "text-blue-400",
  },
  KUNING: {
    name: "Tim Kuning",
    border: "border-amber-500/50",
    bg: "bg-amber-950/20",
    badge: "bg-amber-500 text-slate-950",
    text: "text-amber-400",
  },
  HIJAU: {
    name: "Tim Hijau",
    border: "border-emerald-600/50",
    bg: "bg-emerald-950/20",
    badge: "bg-emerald-600 text-white",
    text: "text-emerald-400",
  },
};

export function TeamBox({ team, widthPercent }: TeamBoxProps) {
  const theme = TEAM_THEMES[team.color];
  const isCompact = widthPercent <= 16;

  return (
    <div
      className={`team-box flex flex-col h-full border-r ${theme.border} ${theme.bg} p-2 overflow-hidden contain-content`}
      style={{
        flexBasis: `${widthPercent}%`,
        minWidth: 0,
        overflow: "hidden",
        transition: "flex-basis 250ms ease",
      }}
      data-testid={`team-box-${team.color.toLowerCase()}`}
    >
      {/* Header Tim */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/60 overflow-hidden flex-shrink-0">
        <div className="flex items-center space-x-1.5 truncate">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}
          >
            {team.color}
          </span>
          {!isCompact && (
            <span className="text-xs font-semibold text-slate-200 truncate">
              {theme.name}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-amber-300">
            {team.points} pts
          </span>
        </div>
      </div>

      {/* Body: Kondisional Berdasarkan Status */}
      <div className="flex-1 w-full overflow-hidden flex flex-col justify-center">
        {team.status === "IN_GATE_QUESTION" && (
          <GateChallengeCard team={team} />
        )}

        {team.status === "IN_FISHING_QUESTION" && (
          <FishingChallengeCard team={team} />
        )}

        {team.status === "TRAVELING" && (
          <div
            className="flex flex-col items-center justify-center p-3 text-center rounded bg-slate-800/40 border border-slate-700/30"
            data-testid="status-traveling"
          >
            <span className="text-2xl animate-bounce mb-1" role="img" aria-label="Walking">
              🚶
            </span>
            <span className="text-xs font-medium text-slate-300">
              Sedang Melangkah Menuju Pos...
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Lokasi: {team.location}
            </span>
          </div>
        )}

        {(team.status === "IDLE_AT_GATE" || team.status === "FISHING_WAITING") && (
          <div
            className="flex flex-col items-center justify-center p-3 text-center rounded bg-slate-800/40 border border-slate-700/30"
            data-testid="status-idle"
          >
            <span className="text-2xl mb-1" role="img" aria-label="Waiting">
              {team.status === "FISHING_WAITING" ? "🎣" : "⏳"}
            </span>
            <span className="text-xs font-medium text-slate-300">
              {team.status === "FISHING_WAITING"
                ? "Menanti Ikan Menyambar Umpan..."
                : "Menunggu Musyawarah Tim..."}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Lokasi: {team.location}
            </span>
          </div>
        )}

        {team.status === "ASSISTED_WAITING" && (
          <div
            className="flex flex-col items-center justify-center p-3 text-center rounded bg-amber-950/30 border border-amber-600/40"
            data-testid="status-assisted-waiting"
          >
            <span className="text-xl mb-1" role="img" aria-label="Book">
              📖
            </span>
            <span className="text-xs font-bold text-amber-300">
              Istirahat Belajar (15 Detik)
            </span>
            <span className="text-[10px] text-amber-200/80 mt-1">
              Santri dipersilakan mengulas jawaban bersama ustadz/ustadzah.
            </span>
          </div>
        )}

        {team.status === "QUEUED_QUESTION" && (
          <div
            className="flex flex-col items-center justify-center p-3 text-center rounded bg-slate-900/60 border border-teal-600/30"
            data-testid="status-queued"
          >
            <span className="text-xl mb-1" role="img" aria-label="Hourglass">
              ⌛
            </span>
            <span className="text-xs font-bold text-teal-300">
              Menunggu Giliran Antrian Layar
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Posisi Antrian: Layar berfokus pada 2 tim utama
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
