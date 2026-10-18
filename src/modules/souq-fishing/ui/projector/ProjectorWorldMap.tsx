import React from "react";
import type { WorldState, TeamColor } from "../../engine/types";
import { ALL_TEAM_COLORS } from "../../engine/world";
import { CharacterAvatar } from "./avatars";

export interface ProjectorWorldMapProps {
  worldState: WorldState;
}

const TEAM_COLOR_HEX: Record<TeamColor, string> = {
  MERAH: "#dc2626",
  BIRU: "#2563eb",
  KUNING: "#eab308",
  HIJAU: "#16a34a",
};

// Horizontal left positions percentage within Pasar Zone
const PASAR_LOCATION_X: Record<string, number> = {
  ALUN: 12,
  KIOS: 38,
  GERBANG_KANTIN: 68,
  KANTIN: 88,
};

// Horizontal left positions percentage within Pancing Zone
const PANCING_LOCATION_X: Record<string, number> = {
  DERMAGA_1: 30,
  DERMAGA_VIP: 75,
};

// Base lane Y positions (offset by 14px per lane to prevent overlap)
const LANE_TOP_OFFSET_PX = 14;
const BASE_LANE_TOP_PX = 45;

export function ProjectorWorldMap({ worldState }: ProjectorWorldMapProps) {
  return (
    <section
      className="projector-world-map grid grid-cols-2 gap-0 overflow-hidden relative h-full w-full select-none"
      data-testid="projector-world-map"
    >
      {/* Kolom Kiri (50% Lebar): Zona Daratan Pasar */}
      <div className="relative h-full w-full bg-gradient-to-br from-amber-950/70 via-stone-900 to-amber-900/50 border-r-2 border-amber-600/40 p-3 overflow-hidden">
        {/* Background Visual Grid & Landmarks */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Zona Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🕌</span>
            <div>
              <h2 className="text-sm font-bold text-amber-300 tracking-wide">
                DARATAN PASAR SANTRI (50%)
              </h2>
              <p className="text-[10px] text-amber-200/70">
                Alun ➔ Kios (G1) ➔ Gerbang Kantin (G2) ➔ Pos Kantin Barokah
              </p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Zona Darat
          </span>
        </div>

        {/* Landmarks Nodes */}
        <div className="absolute inset-x-4 top-20 flex justify-between pointer-events-none text-center">
          <div className="flex flex-col items-center" style={{ left: "10%" }}>
            <span className="text-base">🏕️</span>
            <span className="text-[10px] font-bold text-amber-200">ALUN</span>
          </div>
          <div className="flex flex-col items-center" style={{ left: "38%" }}>
            <span className="text-base">🏪</span>
            <span className="text-[10px] font-bold text-amber-300">KIOS (G1)</span>
          </div>
          <div className="flex flex-col items-center" style={{ left: "68%" }}>
            <span className="text-base">🚪</span>
            <span className="text-[10px] font-bold text-amber-300">G. KANTIN (G2)</span>
          </div>
          <div className="flex flex-col items-center" style={{ left: "88%" }}>
            <span className="text-base">🍲</span>
            <span className="text-[10px] font-bold text-emerald-300">KANTIN</span>
          </div>
        </div>

        {/* 4 Dedicated Walking Lanes (Pasar) */}
        <div className="absolute inset-x-2 top-32 bottom-4 pointer-events-none">
          {ALL_TEAM_COLORS.map((color: TeamColor, laneIdx: number) => {
            const laneTop = BASE_LANE_TOP_PX + laneIdx * LANE_TOP_OFFSET_PX;
            return (
              <div
                key={`lane-pasar-${color}`}
                className="absolute w-full border-b border-dashed border-slate-600/30"
                style={{ top: `${laneTop}px` }}
              />
            );
          })}
        </div>

        {/* Avatars in Pasar Zone */}
        {ALL_TEAM_COLORS.map((color: TeamColor, idx: number) => {
          const team = worldState.teams[color];
          if (team.zone !== "PASAR") return null;

          const laneTop = BASE_LANE_TOP_PX + idx * LANE_TOP_OFFSET_PX - 12;
          const leftPercent = PASAR_LOCATION_X[team.location] ?? 12;

          return (
            <div
              key={`avatar-pasar-${color}`}
              className="absolute transition-all duration-500 ease-out flex flex-col items-center z-20"
              style={{
                top: `${laneTop}px`,
                left: `${leftPercent}%`,
              }}
              data-testid={`avatar-${color.toLowerCase()}`}
            >
              <div
                className="rounded-full p-0.5 shadow-lg"
                style={{
                  border: `2px solid ${TEAM_COLOR_HEX[color]}`,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                }}
              >
                <CharacterAvatar characterId={team.characterId} size={24} />
              </div>
              <span
                className="text-[9px] font-bold px-1 rounded mt-0.5 shadow"
                style={{
                  backgroundColor: TEAM_COLOR_HEX[color],
                  color: color === "KUNING" ? "#0f172a" : "#ffffff",
                }}
              >
                {color}
              </span>
            </div>
          );
        })}
      </div>

      {/* Kolom Kanan (50% Lebar): Zona Perairan Dermaga */}
      <div className="relative h-full w-full bg-gradient-to-br from-teal-950/70 via-slate-900 to-sky-900/50 p-3 overflow-hidden">
        {/* Background Visual Water Ripples */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Zona Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🌊</span>
            <div>
              <h2 className="text-sm font-bold text-teal-300 tracking-wide">
                PERAIRAN DERMAGA PANCING (50%)
              </h2>
              <p className="text-[10px] text-teal-200/70">
                Dermaga 1 (Common & Rare) ➔ Dermaga VIP (Epic & Legendary)
              </p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
            Zona Laut
          </span>
        </div>

        {/* Landmarks Nodes */}
        <div className="absolute inset-x-8 top-20 flex justify-around pointer-events-none text-center">
          <div className="flex flex-col items-center">
            <span className="text-base">⛵</span>
            <span className="text-[10px] font-bold text-teal-300">DERMAGA 1</span>
            <span className="text-[8px] text-teal-400/80">Common / Rare</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-base">🚢</span>
            <span className="text-[10px] font-bold text-amber-300">DERMAGA VIP</span>
            <span className="text-[8px] text-amber-400/80">Epic / Legendary</span>
          </div>
        </div>

        {/* 4 Dedicated Walking Lanes (Pancing) */}
        <div className="absolute inset-x-2 top-32 bottom-4 pointer-events-none">
          {ALL_TEAM_COLORS.map((color: TeamColor, laneIdx: number) => {
            const laneTop = BASE_LANE_TOP_PX + laneIdx * LANE_TOP_OFFSET_PX;
            return (
              <div
                key={`lane-pancing-${color}`}
                className="absolute w-full border-b border-dashed border-teal-600/30"
                style={{ top: `${laneTop}px` }}
              />
            );
          })}
        </div>

        {/* Avatars in Dermaga Zone */}
        {ALL_TEAM_COLORS.map((color: TeamColor, idx: number) => {
          const team = worldState.teams[color];
          if (team.zone !== "DERMAGA") return null;

          const laneTop = BASE_LANE_TOP_PX + idx * LANE_TOP_OFFSET_PX - 12;
          const leftPercent = PANCING_LOCATION_X[team.location] ?? 30;

          return (
            <div
              key={`avatar-pancing-${color}`}
              className="absolute transition-all duration-500 ease-out flex flex-col items-center z-20"
              style={{
                top: `${laneTop}px`,
                left: `${leftPercent}%`,
              }}
              data-testid={`avatar-${color.toLowerCase()}`}
            >
              <div
                className="rounded-full p-0.5 shadow-lg"
                style={{
                  border: `2px solid ${TEAM_COLOR_HEX[color]}`,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                }}
              >
                <CharacterAvatar characterId={team.characterId} size={24} />
              </div>
              <span
                className="text-[9px] font-bold px-1 rounded mt-0.5 shadow"
                style={{
                  backgroundColor: TEAM_COLOR_HEX[color],
                  color: color === "KUNING" ? "#0f172a" : "#ffffff",
                }}
              >
                {color}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
