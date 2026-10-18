import React from "react";
import type { TeamState, LocationId } from "../../engine/types";
import { CharacterAvatar } from "../projector/avatars";

export interface WalkingViewProps {
  team: TeamState;
  gatesUnlocked?: {
    GERBANG_KANTIN?: boolean;
    KIOS?: boolean;
  };
  hasVIPKey?: boolean;
  onAction?: (action: string, payload?: unknown) => void;
}

const LOCATION_COORDINATES: Record<LocationId, { x: number; y: number; label: string }> = {
  ALUN: { x: 30, y: 55, label: "Alun" },
  KIOS: { x: 95, y: 55, label: "Kios" },
  GERBANG_KANTIN: { x: 160, y: 55, label: "Gerbang" },
  KANTIN: { x: 225, y: 55, label: "Kantin" },
  DERMAGA_1: { x: 290, y: 55, label: "Dermaga 1" },
  DERMAGA_VIP: { x: 340, y: 55, label: "VIP" },
};

export function WalkingView({
  team,
  gatesUnlocked,
  hasVIPKey,
  onAction,
}: WalkingViewProps) {
  const isTraveling = team.status === "TRAVELING";
  const currentCoords = LOCATION_COORDINATES[team.location] || LOCATION_COORDINATES.ALUN;

  const handleNavigate = (destination: LocationId) => {
    if (isTraveling) return;
    onAction?.("navigate", { destination });
  };

  // Lock status conditions
  const isKantinLocked =
    gatesUnlocked?.GERBANG_KANTIN !== undefined
      ? !gatesUnlocked.GERBANG_KANTIN
      : team.pinsUnlocked < 4 && team.location !== "KANTIN";

  const isVIPLocked =
    hasVIPKey !== undefined
      ? !hasVIPKey
      : team.points < 500 && team.location !== "DERMAGA_VIP";

  return (
    <div
      className="flex flex-col h-full w-full justify-between p-3 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="walking-view"
    >
      {/* Mini-map SVG Strip (30vh container) */}
      <div className="flex flex-col items-center w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2 h-[30vh] justify-center">
        <div className="w-full flex justify-between items-center px-2 mb-1">
          <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
            Peta Lokasi & Perjalanan
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {isTraveling ? "Sedang Berjalan..." : `Di: ${team.location}`}
          </span>
        </div>

        {/* Pure SVG Mini-map (Zero Canvas, Zero Fixed/Absolute) */}
        <svg
          viewBox="0 0 370 110"
          className="w-full h-full max-h-[22vh]"
          data-testid="mini-map-svg"
          aria-label="Mini Peta Petualangan"
        >
          {/* Path Line */}
          <line
            x1="30"
            y1="55"
            x2="340"
            y2="55"
            stroke="#475569"
            strokeWidth="3"
            strokeDasharray="4 4"
          />

          {/* Location Nodes */}
          {Object.entries(LOCATION_COORDINATES).map(([locId, loc]) => {
            const isCurrent = team.location === locId;
            return (
              <g key={locId}>
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={isCurrent ? "10" : "7"}
                  fill={isCurrent ? "#f59e0b" : "#1e293b"}
                  stroke={isCurrent ? "#fbbf24" : "#64748b"}
                  strokeWidth="2"
                />
                <text
                  x={loc.x}
                  y={loc.y + 22}
                  textAnchor="middle"
                  fill={isCurrent ? "#fbbf24" : "#94a3b8"}
                  fontSize="8"
                  fontWeight="bold"
                >
                  {loc.label}
                </text>
              </g>
            );
          })}

          {/* Current Avatar on Map */}
          <g transform={`translate(${currentCoords.x - 12}, ${currentCoords.y - 30})`}>
            <circle cx="12" cy="14" r="14" fill="#f59e0b" fillOpacity="0.25" />
            <foreignObject width="24" height="32" x="0" y="0">
              <div
                className="w-full h-full flex items-center justify-center"
                data-testid={`character-avatar-${team.characterId.replace(/_/g, "-")}`}
              >
                <CharacterAvatar characterId={team.characterId} size={24} />
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>

      {/* Movement / Destination Controls */}
      <div className="flex flex-col space-y-2 mt-3 mb-1">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Pilih Destinasi
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Kios */}
          <button
            type="button"
            onClick={() => handleNavigate("KIOS")}
            disabled={isTraveling || team.location === "KIOS"}
            data-testid="dest-button-kios"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 disabled:opacity-40 min-h-[56px] transition-all"
          >
            <span className="text-xs font-bold text-amber-300">🏪 Kios Pasar</span>
            <span className="text-[10px] text-slate-400">Gembok 1 (3 Pin)</span>
          </button>

          {/* Kantin */}
          <button
            type="button"
            onClick={() => handleNavigate("KANTIN")}
            disabled={isTraveling || isKantinLocked || team.location === "KANTIN"}
            data-testid="dest-button-kantin"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 disabled:opacity-40 min-h-[56px] transition-all"
          >
            <span className="text-xs font-bold text-amber-300">
              🍲 Kantin {isKantinLocked ? "🔒" : ""}
            </span>
            <span className="text-[10px] text-slate-400">
              {isKantinLocked ? "Perlu Kunci Gerbang" : "Buka (Buff Pancing)"}
            </span>
          </button>

          {/* Dermaga 1 */}
          <button
            type="button"
            onClick={() => handleNavigate("DERMAGA_1")}
            disabled={isTraveling || team.location === "DERMAGA_1"}
            data-testid="dest-button-dermaga-1"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-sky-500/30 bg-sky-950/20 hover:bg-sky-950/40 disabled:opacity-40 min-h-[56px] transition-all"
          >
            <span className="text-xs font-bold text-sky-300">🎣 Dermaga 1</span>
            <span className="text-[10px] text-slate-400">Pancing Terbuka</span>
          </button>

          {/* Dermaga VIP */}
          <button
            type="button"
            onClick={() => handleNavigate("DERMAGA_VIP")}
            disabled={isTraveling || isVIPLocked || team.location === "DERMAGA_VIP"}
            data-testid="dest-button-dermaga-vip"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-teal-500/30 bg-teal-950/20 hover:bg-teal-950/40 disabled:opacity-40 min-h-[56px] transition-all"
          >
            <span className="text-xs font-bold text-teal-300">
              ✨ Dermaga VIP {isVIPLocked ? "🔒" : ""}
            </span>
            <span className="text-[10px] text-slate-400">
              {isVIPLocked ? "Butuh Kunci Emas" : "Ikan Langka & Epik"}
            </span>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
        <span className="text-slate-400">Skor Tim:</span>
        <span className="font-bold text-amber-400">{team.points} Poin</span>
      </div>
    </div>
  );
}
