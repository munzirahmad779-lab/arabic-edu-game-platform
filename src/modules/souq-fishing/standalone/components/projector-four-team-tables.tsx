"use client";

import React from "react";
import type { StandaloneTeamState, TeamColor } from "../types";
import { calculateActiveTiltWidths, TEAM_LANE_OFFSETS } from "../engine";
import { CharacterAvatar } from "./character-avatar";

interface Props {
  teams: Record<TeamColor, StandaloneTeamState>;
  onAnswerQuestion?: (team: TeamColor, optionKey: "A" | "B" | "C" | "D") => void;
  onOpenGateChallenge?: (team: TeamColor) => void;
  onStartFishingChallenge?: (team: TeamColor) => void;
}

export function ProjectorFourTeamTables({
  teams,
  onAnswerQuestion,
  onOpenGateChallenge,
  onStartFishingChallenge,
}: Props) {
  const teamColors: TeamColor[] = ["MERAH", "BIRU", "KUNING", "HIJAU"];
  const widths = calculateActiveTiltWidths(teams);

  return (
    <div className="w-full h-full flex flex-row gap-2 p-2.5 bg-slate-950 overflow-hidden select-none">
      {teamColors.map((color) => {
        const team = teams[color];
        const widthPct = widths[color];
        const lane = TEAM_LANE_OFFSETS[color];
        const isAnsweringGate = team.status === "IN_GATE_QUESTION";
        const isFishing = team.status === "IN_FISHING_QUESTION";
        const isExpanded = isAnsweringGate || isFishing;

        return (
          <div
            key={color}
            className={`h-full rounded-2xl flex flex-col justify-between p-3 transition-all duration-300 ease-in-out relative overflow-hidden border-2 shadow-2xl ${
              isExpanded
                ? "bg-gradient-to-b from-[#064E3B] via-slate-900 to-slate-950 border-amber-400 ring-2 ring-amber-400/40"
                : "bg-slate-900/90 border-slate-700/80 hover:border-amber-400/50"
            }`}
            style={{
              flexBasis: `${widthPct}%`,
              maxWidth: `${widthPct}%`,
              minWidth: "12%",
            }}
          >
            {/* Header Lencana Tim & Skor */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white uppercase tracking-wider shadow-sm"
                  style={{ backgroundColor: lane.colorHex }}
                >
                  {lane.label}
                </span>
                <span className="text-xs font-bold text-slate-200 truncate hidden sm:inline">
                  {team.location}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-xs text-amber-300 font-black">⭐ {team.points}</span>
              </div>
            </div>

            {/* BODY KOTAK TIM: 3 STATE EKSKLUSIF */}

            {/* STATE A: MEMBUKA GEMBOK GERBANG (GATE_QUESTION) */}
            {isAnsweringGate && team.currentQuestion ? (
              <div className="flex-1 flex flex-col justify-between gap-2 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3">
                  {/* Sisi Kiri: Gembok Emas Besar + Indikator Pin */}
                  <div className="shrink-0 flex flex-col items-center bg-black/40 p-2.5 rounded-xl border border-amber-400/40">
                    <span className="text-3xl animate-bounce">🔒</span>
                    <span className="text-[10px] font-black text-amber-300 mt-1">GEMBOK PIN</span>
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 3, 4].map((pin) => (
                        <span
                          key={pin}
                          className={`text-xs ${
                            pin <= team.pinsUnlocked ? "text-emerald-400" : "text-slate-600"
                          }`}
                        >
                          {pin <= team.pinsUnlocked ? "🔓" : "🔒"}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sisi Kanan: Teks Soal Terang */}
                  <div className="flex-1 min-w-0 bg-slate-800/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                      Kuis Buka Gerbang:
                    </div>
                    <div
                      className="text-xs font-bold text-white leading-relaxed line-clamp-3"
                      dir="auto"
                    >
                      {team.currentQuestion.question_text}
                    </div>
                  </div>
                </div>

                {/* 4 Tombol Pilihan Jawaban (A, B, C, D) Langsung Diklik di Proyektor */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const optText =
                      opt === "A"
                        ? team.currentQuestion?.option_a
                        : opt === "B"
                        ? team.currentQuestion?.option_b
                        : opt === "C"
                        ? team.currentQuestion?.option_c
                        : team.currentQuestion?.option_d;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onAnswerQuestion?.(color, opt)}
                        className="p-2 rounded-xl text-left bg-white/10 hover:bg-amber-500/20 active:scale-95 transition border border-white/20 hover:border-amber-400 flex items-center gap-2 group"
                      >
                        <span className="w-5 h-5 rounded-lg bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
                          {opt}
                        </span>
                        <span className="text-[11px] font-bold text-slate-100 truncate" dir="auto">
                          {optText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isFishing && team.currentQuestion ? (
              /* STATE B: MENARIK IKAN (FISHING_QUESTION) */
              <div className="flex-1 flex flex-col justify-between gap-2 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3">
                  {/* Sisi Kiri: Ikan Melompat + Pita Poin */}
                  <div className="shrink-0 flex flex-col items-center bg-gradient-to-b from-sky-900 to-sky-950 p-2.5 rounded-xl border border-sky-400/50">
                    <span className="text-3xl animate-bounce">🐟</span>
                    <span className="text-[10px] font-black text-amber-300 mt-1">
                      +{team.currentFishCatch?.points || 300} PTS!
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 mt-1 uppercase">
                      {team.currentFishCatch?.rarity || "RARE"}
                    </span>
                  </div>

                  {/* Sisi Kanan: Kartu Soal Mancing */}
                  <div className="flex-1 min-w-0 bg-slate-800/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">
                      🎣 Ikan Menyambar! Jawab Cepat:
                    </div>
                    <div
                      className="text-xs font-bold text-white leading-relaxed line-clamp-3"
                      dir="auto"
                    >
                      {team.currentQuestion.question_text}
                    </div>
                  </div>
                </div>

                {/* 4 Tombol Jawaban Mancing */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const optText =
                      opt === "A"
                        ? team.currentQuestion?.option_a
                        : opt === "B"
                        ? team.currentQuestion?.option_b
                        : opt === "C"
                        ? team.currentQuestion?.option_c
                        : team.currentQuestion?.option_d;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onAnswerQuestion?.(color, opt)}
                        className="p-2 rounded-xl text-left bg-sky-950/60 hover:bg-sky-500/30 active:scale-95 transition border border-sky-400/30 hover:border-sky-300 flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded-lg bg-sky-400 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
                          {opt}
                        </span>
                        <span className="text-[11px] font-bold text-slate-100 truncate" dir="auto">
                          {optText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* STATE C: IDLE / TRAVELING */
              <div className="flex-1 flex flex-col justify-between items-center text-center p-1">
                <div className="flex items-center gap-3">
                  <CharacterAvatar
                    character={
                      color === "MERAH"
                        ? "putri_hijab"
                        : color === "BIRU"
                        ? "putra_peci"
                        : color === "KUNING"
                        ? "putri_non_hijab"
                        : "putra_non_peci"
                    }
                    teamColor={color}
                    size="sm"
                    showRibbon={false}
                    isWalking={team.status === "TRAVELING"}
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">
                      {team.status === "TRAVELING" ? "🚶 Sedang Jalan..." : "⏳ Bersiap"}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Lokasi: {team.location}
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Demo / Buka Soal Langsung dari Proyektor */}
                <div className="w-full flex flex-col gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => onOpenGateChallenge?.(color)}
                    className="w-full py-1.5 px-2 rounded-xl text-[10px] font-black text-amber-300 bg-amber-950/70 hover:bg-amber-900 border border-amber-400/40 shadow-sm active:scale-95 transition"
                  >
                    🔓 Tes Soal Gerbang
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartFishingChallenge?.(color)}
                    className="w-full py-1.5 px-2 rounded-xl text-[10px] font-black text-sky-300 bg-sky-950/70 hover:bg-sky-900 border border-sky-400/40 shadow-sm active:scale-95 transition"
                  >
                    🎣 Tes Tarik Ikan
                  </button>
                </div>
              </div>
            )}

            {/* Footer Pin & Badge Hasil Tangkapan */}
            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono">Pin: {team.pinsUnlocked}/4</span>
              <span>🐟 {team.fishCatches.length} Ikan</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
