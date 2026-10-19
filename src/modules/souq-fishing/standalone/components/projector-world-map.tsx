"use client";

import React from "react";
import type { StandaloneTeamState, TeamColor, LocationId } from "../types";
import { LOCATION_COORDINATES, TEAM_LANE_OFFSETS } from "../engine";
import { CharacterAvatar } from "./character-avatar";

interface Props {
  teams: Record<TeamColor, StandaloneTeamState>;
  onLocationClick?: (location: LocationId) => void;
  onTeamMove?: (team: TeamColor, target: LocationId) => void;
}

export function ProjectorWorldMap({ teams, onLocationClick, onTeamMove }: Props) {
  const teamColors: TeamColor[] = ["MERAH", "BIRU", "KUNING", "HIJAU"];

  return (
    <div
      className="relative w-full h-full overflow-hidden border-b-4 border-amber-400 select-none shadow-2xl"
      style={{
        background: "linear-gradient(to right, #22C55E 0%, #4ADE80 56%, #FDE047 60%, #38BDF8 64%, #0284C7 100%)",
      }}
    >
      {/* SVG Background Elements & Paths */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          {/* Pola Pasir Krem */}
          <linearGradient id="sandPath" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>
          {/* Ombak Laut */}
          <linearGradient id="oceanWave" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369A1" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Garis Pantai Bergurat Alami */}
        <path
          d="M 580 0 Q 610 300 590 600 Q 620 900 600 1200 L 1920 1200 L 1920 0 Z"
          fill="url(#oceanWave)"
          opacity="0.35"
        />

        {/* Ombak Laut Bergerak (Wave ripple accents) */}
        <path
          d="M 1200 80 Q 1300 60 1400 80 T 1600 80"
          stroke="#E0F2FE"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
          className="animate-pulse"
        />
        <path
          d="M 1350 240 Q 1450 220 1550 240 T 1750 240"
          stroke="#E0F2FE"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M 1250 420 Q 1350 400 1450 420 T 1650 420"
          stroke="#BAE6FD"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        {/* JALUR JALAN PASIR KREM (Dotted Road connecting all 6 landmarks) */}
        {/* Jalur 1: Start (8%) -> Kios (26%) */}
        <line
          x1="8%"
          y1="50%"
          x2="26%"
          y2="44%"
          stroke="#FEF08A"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <line
          x1="8%"
          y1="50%"
          x2="26%"
          y2="44%"
          stroke="#92400E"
          strokeWidth="3"
          strokeDasharray="8 8"
          strokeLinecap="round"
        />

        {/* Jalur 2: Kios (26%) -> Gerbang Kantin (44%) */}
        <line
          x1="26%"
          y1="44%"
          x2="44%"
          y2="50%"
          stroke="#FEF08A"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <line
          x1="26%"
          y1="44%"
          x2="44%"
          y2="50%"
          stroke="#92400E"
          strokeWidth="3"
          strokeDasharray="8 8"
          strokeLinecap="round"
        />

        {/* Jalur 3: Gerbang Kantin (44%) -> Kantin (58%) */}
        <line
          x1="44%"
          y1="50%"
          x2="58%"
          y2="44%"
          stroke="#FEF08A"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <line
          x1="44%"
          y1="50%"
          x2="58%"
          y2="44%"
          stroke="#92400E"
          strokeWidth="3"
          strokeDasharray="8 8"
          strokeLinecap="round"
        />

        {/* Jalur 4: Kantin (58%) -> Dermaga Umum (75%) */}
        <path
          d="M 58% 44% Q 66% 62% 75% 66%"
          stroke="#FEF08A"
          strokeWidth="24"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 58% 44% Q 66% 62% 75% 66%"
          stroke="#92400E"
          strokeWidth="3"
          strokeDasharray="8 8"
          fill="none"
          strokeLinecap="round"
        />

        {/* Jalur 5: Kantin (58%) -> Dermaga VIP (88%) */}
        <path
          d="M 58% 44% Q 72% 32% 88% 34%"
          stroke="#FDE047"
          strokeWidth="24"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 58% 44% Q 72% 32% 88% 34%"
          stroke="#B45309"
          strokeWidth="3"
          strokeDasharray="8 8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {/* PEPOHONAN HIJAU RIMBUN DI SEKITAR PASAR */}
      <div className="absolute top-4 left-6 pointer-events-none flex gap-2">
        <div className="w-12 h-12 rounded-full bg-emerald-700 shadow-md border-2 border-emerald-500/50" />
        <div className="w-16 h-16 -ml-4 -mt-2 rounded-full bg-green-600 shadow-md border-2 border-emerald-400/50" />
        <div className="w-10 h-10 -ml-3 rounded-full bg-emerald-800 shadow-md" />
      </div>

      <div className="absolute bottom-6 left-12 pointer-events-none flex gap-2">
        <div className="w-14 h-14 rounded-full bg-emerald-800 shadow-md border-2 border-emerald-600/50" />
        <div className="w-12 h-12 -ml-4 -mt-2 rounded-full bg-green-700 shadow-md" />
      </div>

      <div className="absolute top-6 left-[48%] pointer-events-none flex gap-1">
        <div className="w-11 h-11 rounded-full bg-emerald-800 shadow-md" />
        <div className="w-14 h-14 -ml-4 rounded-full bg-green-600 shadow-md" />
      </div>

      {/* KAPAL NELAYAN KAYU BERGERAK DI LAUT */}
      <div className="absolute bottom-8 right-24 pointer-events-none transition-transform duration-1000">
        <div className="w-20 h-7 bg-amber-800 rounded-b-2xl border-2 border-amber-600 shadow-xl flex items-center justify-center text-[10px] font-black text-amber-200">
          ⛵ LOPI BALE
        </div>
      </div>

      {/* --- 6 LANDMARK UTAMA (BANGUNAN & DERMAGA) --- */}

      {/* 1. START: Pintu Masuk Pasar */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.START.x}%`, top: `${LOCATION_COORDINATES.START.y}%` }}
        onClick={() => onLocationClick?.("START")}
      >
        <div className="flex flex-col items-center">
          <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 text-amber-300 font-black text-[11px] shadow-lg border border-amber-400/60 mb-1">
            🎪 GERBANG MASUK
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500 border-2 border-white shadow-xl flex items-center justify-center text-xl group-hover:scale-110 transition">
            🏛️
          </div>
        </div>
      </div>

      {/* 2. KIOS: Gerbang Kios (G1) dengan Pagar Besi & Gembok Emas */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.KIOS.x}%`, top: `${LOCATION_COORDINATES.KIOS.y}%` }}
        onClick={() => onLocationClick?.("KIOS")}
      >
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 rounded-xl bg-emerald-950 text-emerald-200 font-black text-[11px] shadow-lg border-2 border-emerald-400 mb-1 flex items-center gap-1.5">
            <span className="text-amber-300">🔒</span>
            <span>KIOS PASAR (G1)</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 border-3 border-amber-300 shadow-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition">
            🏪
          </div>
          <span className="mt-1 text-[10px] font-bold text-slate-950 bg-amber-200 px-2 py-0.5 rounded-full border border-amber-400">
            Tantangan Gembok
          </span>
        </div>
      </div>

      {/* 3. GERBANG KANTIN (G2) dengan Gembok Emas */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.GERBANG_KANTIN.x}%`, top: `${LOCATION_COORDINATES.GERBANG_KANTIN.y}%` }}
        onClick={() => onLocationClick?.("GERBANG_KANTIN")}
      >
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 rounded-xl bg-purple-950 text-purple-200 font-black text-[11px] shadow-lg border-2 border-purple-400 mb-1 flex items-center gap-1.5">
            <span className="text-amber-300">🔒</span>
            <span>GERBANG KANTIN (G2)</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-700 to-indigo-900 border-3 border-amber-300 shadow-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition">
            ⛩️
          </div>
          <span className="mt-1 text-[10px] font-bold text-slate-950 bg-amber-200 px-2 py-0.5 rounded-full border border-amber-400">
            Kunci Akses
          </span>
        </div>
      </div>

      {/* 4. KANTIN: Pujasera Santri */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.KANTIN.x}%`, top: `${LOCATION_COORDINATES.KANTIN.y}%` }}
        onClick={() => onLocationClick?.("KANTIN")}
      >
        <div className="flex flex-col items-center">
          <div className="px-2.5 py-1 rounded-xl bg-slate-900 text-teal-300 font-black text-[11px] shadow-lg border border-teal-400 mb-1">
            🍲 KANTIN SANTRI
          </div>
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 border-2 border-white shadow-xl flex items-center justify-center text-2xl group-hover:scale-110 transition">
            🍽️
          </div>
        </div>
      </div>

      {/* 5. DERMAGA 1: Jembatan Kayu Dermaga Umum */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.DERMAGA_1.x}%`, top: `${LOCATION_COORDINATES.DERMAGA_1.y}%` }}
        onClick={() => onLocationClick?.("DERMAGA_1")}
      >
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 rounded-xl bg-sky-950 text-sky-200 font-black text-[11px] shadow-lg border-2 border-sky-400 mb-1 flex items-center gap-1">
            <span>🎣</span>
            <span>DERMAGA UMUM</span>
          </div>
          {/* Ilustrasi Jembatan Kayu Dermaga */}
          <div className="w-16 h-12 bg-amber-800 rounded-lg border-2 border-amber-600 shadow-2xl flex flex-col items-center justify-center group-hover:scale-110 transition">
            <div className="text-xl">🐟</div>
            <div className="text-[8px] font-black text-amber-200">Spot Mancing</div>
          </div>
        </div>
      </div>

      {/* 6. DERMAGA VIP: Jembatan Kayu VIP dengan Bendera Kuning Emas */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        style={{ left: `${LOCATION_COORDINATES.DERMAGA_VIP.x}%`, top: `${LOCATION_COORDINATES.DERMAGA_VIP.y}%` }}
        onClick={() => onLocationClick?.("DERMAGA_VIP")}
      >
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 rounded-xl bg-amber-950 text-amber-300 font-black text-[11px] shadow-2xl border-2 border-amber-400 mb-1 flex items-center gap-1.5 animate-bounce">
            <span>👑</span>
            <span>DERMAGA VIP EMAS</span>
          </div>
          {/* Jembatan Kayu Emas Megah */}
          <div className="w-18 h-14 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-xl border-3 border-yellow-200 shadow-2xl flex flex-col items-center justify-center group-hover:scale-110 transition relative">
            <span className="absolute -top-3 -right-2 text-xs">🚩</span>
            <div className="text-2xl drop-shadow-md">🦈</div>
            <div className="text-[9px] font-black text-slate-950 bg-amber-200 px-1.5 rounded-sm">
              Ikan Legendaris
            </div>
          </div>
        </div>
      </div>

      {/* --- 4 AVATAR TIM PADA JALUR MASING-MASING (DILARANG MENUMPUK!) --- */}
      {teamColors.map((color) => {
        const team = teams[color];
        const coord = LOCATION_COORDINATES[team.location] || LOCATION_COORDINATES.START;
        const lane = TEAM_LANE_OFFSETS[color];
        const isWalking = team.status === "TRAVELING";

        return (
          <div
            key={color}
            className="absolute transition-all duration-1000 ease-in-out cursor-pointer"
            style={{
              left: `${coord.x}%`,
              top: `${coord.y}%`,
              transform: `translate(calc(-50% + ${lane.xOffset}px), calc(-50% + ${lane.yOffset}px))`,
              zIndex: 30 + (color === "MERAH" ? 4 : color === "BIRU" ? 3 : color === "KUNING" ? 2 : 1),
            }}
            title={`${team.name} di ${coord.name}`}
          >
            <CharacterAvatar
              character={color === "MERAH" ? "putri_hijab" : color === "BIRU" ? "putra_peci" : color === "KUNING" ? "putri_non_hijab" : "putra_non_peci"}
              teamColor={color}
              size="md"
              showRibbon={true}
              isWalking={isWalking}
            />

            {/* Status Tooltip Kecil Saat Buka Soal / Mancing */}
            {team.status === "IN_GATE_QUESTION" && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md shadow-lg border border-white animate-pulse">
                🔓 Membuka Gembok...
              </div>
            )}
            {team.status === "IN_FISHING_QUESTION" && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-sky-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md shadow-lg border border-white animate-bounce">
                🎣 Menarik Ikan!
              </div>
            )}
          </div>
        );
      })}

      {/* Host Quick Navigation Bar Atas (Interactive Host Controls) */}
      <div className="absolute top-2.5 right-4 z-40 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-amber-400/60 shadow-xl flex items-center gap-3">
        <span className="text-[11px] font-black text-amber-300">🕹️ DEMO GERAK CEPAT:</span>
        <button
          type="button"
          onClick={() => onTeamMove?.("MERAH", "KIOS")}
          className="px-2 py-1 rounded-lg text-[10px] font-black text-white bg-rose-600 hover:bg-rose-500 shadow-sm"
        >
          🔴 Merah ➔ Kios
        </button>
        <button
          type="button"
          onClick={() => onTeamMove?.("BIRU", "GERBANG_KANTIN")}
          className="px-2 py-1 rounded-lg text-[10px] font-black text-white bg-blue-600 hover:bg-blue-500 shadow-sm"
        >
          🔵 Biru ➔ G2
        </button>
        <button
          type="button"
          onClick={() => onTeamMove?.("KUNING", "DERMAGA_1")}
          className="px-2 py-1 rounded-lg text-[10px] font-black text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-sm"
        >
          🟡 Kuning ➔ Dermaga
        </button>
        <button
          type="button"
          onClick={() => onTeamMove?.("HIJAU", "DERMAGA_VIP")}
          className="px-2 py-1 rounded-lg text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm"
        >
          🟢 Hijau ➔ VIP
        </button>
      </div>
    </div>
  );
}
