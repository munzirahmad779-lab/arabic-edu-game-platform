"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { CharacterAvatar } from "@/modules/souq-fishing/standalone/components/character-avatar";
import { TEAM_LANE_OFFSETS, LOCATION_COORDINATES } from "@/modules/souq-fishing/standalone/engine";
import type {
  StandaloneRoomState,
  TeamColor,
  CharacterChoice,
} from "@/modules/souq-fishing/standalone/types";

export default function SouqFishingMobileControllerPage() {
  const params = useParams();
  const roomCode = ((params?.roomCode as string) || "SOUQ01").toUpperCase();

  // Local state
  const [studentName, setStudentName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamColor>("MERAH");
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterChoice>("putra_peci");
  const [hasJoined, setHasJoined] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [room, setRoom] = useState<StandaloneRoomState | null>(null);

  const bcRef = useRef<BroadcastChannel | null>(null);
  const studentIdRef = useRef(`std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

  // Fast polling & BroadcastChannel
  const fetchRoomState = useCallback(async () => {
    try {
      const res = await fetch(`/api/souq-fishing/session?roomCode=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          setRoom(data.room);
        }
      }
    } catch {
      // ignore
    }
  }, [roomCode]);

  const dispatchAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/souq-fishing/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, roomCode, payload }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            setRoom(data.room);
            bcRef.current?.postMessage({ type: "ROOM_UPDATED", room: data.room });
          }
        }
      } catch (err) {
        console.error("Action error:", err);
      }
    },
    [roomCode]
  );

  useEffect(() => {
    fetchRoomState();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel(`souq-fishing-sync-${roomCode}`);
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === "ROOM_UPDATED" && event.data.room) {
          setRoom(event.data.room);
        }
      };
    }

    const interval = setInterval(fetchRoomState, 600);
    return () => {
      clearInterval(interval);
      bcRef.current?.close();
    };
  }, [roomCode, fetchRoomState]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    setHasJoined(true);
    dispatchAction("JOIN_STUDENT", {
      student: {
        id: studentIdRef.current,
        name: studentName.trim(),
        team: selectedTeam,
        character: selectedCharacter,
        currentQIndex: 0,
        totalQAnswered: 0,
        correctCount: 0,
        currentZone: "Pintu Masuk Pasar",
        fishBadges: [],
        lastActive: Date.now(),
      },
    });
  };

  const myTeam = room?.teams[selectedTeam];
  const lane = TEAM_LANE_OFFSETS[selectedTeam];

  // ==========================================
  // STATE 1: PILIH KARAKTER & TIM (LOBBY JOIN)
  // ==========================================
  if (!hasJoined) {
    return (
      <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto bg-slate-950 text-white p-4 flex flex-col items-center justify-center select-none">
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 flex items-center justify-center text-2xl shadow-lg border border-white/30">
              🎣
            </div>
            <h1 className="text-lg font-black text-white">Ekspedisi Pasar & Dermaga</h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Room: <span className="text-amber-300 font-bold">{roomCode}</span> • Pilih Karakter & Tim
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {/* Input Nama Siswa */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nama Lengkap / Panggilan Siswa:
              </label>
              <input
                type="text"
                required
                maxLength={30}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Contoh: Ahmad / Fathimah"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
              />
            </div>

            {/* Pilihan 4 Tim */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Pilih Tim Regu:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["MERAH", "BIRU", "KUNING", "HIJAU"] as const).map((col) => {
                  const tm = TEAM_LANE_OFFSETS[col];
                  const isSelected = selectedTeam === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedTeam(col)}
                      className={`p-2.5 rounded-xl text-left border-2 flex items-center gap-2 transition ${
                        isSelected
                          ? `bg-gradient-to-r ${tm.bgClass} border-white text-white shadow-md scale-[1.02]`
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tm.colorHex }} />
                      <span className="text-xs font-black">{tm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pilihan 4 Karakter SVG */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Pilih Avatar Karakter:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "putri_hijab", label: "Putri Hijab" },
                  { id: "putri_non_hijab", label: "Putri Non-Hijab" },
                  { id: "putra_peci", label: "Putra Peci" },
                  { id: "putra_non_peci", label: "Putra Non-Peci" },
                ].map((char) => {
                  const isSelected = selectedCharacter === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => setSelectedCharacter(char.id as CharacterChoice)}
                      className={`p-2 rounded-2xl border-2 flex flex-col items-center gap-1 transition ${
                        isSelected
                          ? "bg-amber-500/20 border-amber-400 shadow-md scale-[1.03]"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <CharacterAvatar
                        character={char.id as CharacterChoice}
                        teamColor={selectedTeam}
                        size="sm"
                        showRibbon={false}
                      />
                      <span className="text-[11px] font-bold text-slate-200">{char.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tombol Mulai Bermain */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide shadow-xl active:scale-95 transition"
            >
              MULAI BERMAIN 🚀
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 3: BUKA GERBANG SOAL (GATE QUESTION)
  // =========================================================================
  if (myTeam?.status === "IN_GATE_QUESTION" && myTeam.currentQuestion) {
    const q = myTeam.currentQuestion;

    return (
      <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto bg-slate-950 text-white p-4 flex flex-col justify-between select-none">
        {/* Top Mini Header */}
        <div className="flex items-center justify-between border-b border-amber-400/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl animate-bounce">🔒</span>
            <div>
              <div className="text-xs font-black text-amber-300">TANTANGAN BUKA GERBANG</div>
              <div className="text-[10px] text-slate-400">Lokasi: {myTeam.location}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-xl border border-amber-400/30">
            <span className="text-xs font-black text-amber-300">PIN:</span>
            <span className="text-xs font-mono font-black text-emerald-400">
              {myTeam.pinsUnlocked}/4
            </span>
          </div>
        </div>

        {/* Question Card Body */}
        <div className="my-auto py-4 space-y-3">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-4 shadow-xl">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 uppercase">
              Soal Mufrodat / Fiqih
            </span>
            <h2
              className="mt-2 text-base sm:text-lg font-bold text-white leading-relaxed"
              dir="auto"
            >
              {q.question_text}
            </h2>
          </div>

          {/* 4 Contrast Big Answer Buttons */}
          <div className="grid grid-cols-1 gap-2.5">
            {(["A", "B", "C", "D"] as const).map((opt) => {
              const optText =
                opt === "A" ? q.option_a : opt === "B" ? q.option_b : opt === "C" ? q.option_c : q.option_d;
              const btnColors = {
                A: "from-rose-600 to-red-700 border-rose-400",
                B: "from-sky-600 to-blue-700 border-sky-400",
                C: "from-amber-500 to-yellow-600 border-amber-400",
                D: "from-emerald-600 to-teal-700 border-emerald-400",
              }[opt];

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    dispatchAction("ANSWER_QUESTION", {
                      team: selectedTeam,
                      optionKey: opt,
                      studentId: studentIdRef.current,
                    })
                  }
                  className={`p-3.5 rounded-2xl bg-gradient-to-r ${btnColors} border-2 text-white font-bold text-sm shadow-lg flex items-center gap-3 active:scale-95 transition`}
                >
                  <span className="w-8 h-8 rounded-xl bg-white text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                    {opt}
                  </span>
                  <span className="text-left font-bold" dir="auto">
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-500">
          Tekan salah satu jawaban untuk membuka gembok gerbang!
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 4: TANGKAP IKAN (FISHING QUESTION)
  // =========================================================================
  if (myTeam?.status === "IN_FISHING_QUESTION" && myTeam.currentQuestion) {
    const q = myTeam.currentQuestion;
    const fish = myTeam.currentFishCatch;

    return (
      <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto bg-slate-950 text-white p-4 flex flex-col justify-between select-none">
        {/* Top Fishing Header */}
        <div className="flex items-center justify-between border-b border-sky-400/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🎣</span>
            <div>
              <div className="text-xs font-black text-sky-300">IKAN MENYAMBAR KAIL!</div>
              <div className="text-[10px] text-slate-400">Tarik kail dengan menjawab benar!</div>
            </div>
          </div>
          <div className="bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black shadow-md">
            +{fish?.points || 300} PTS!
          </div>
        </div>

        {/* Fish Jumping Card */}
        <div className="my-auto py-2 space-y-3">
          <div className="bg-gradient-to-b from-sky-950 to-slate-900 border-2 border-sky-400 rounded-2xl p-3.5 shadow-xl text-center space-y-2">
            <div className="text-4xl animate-bounce">🐟</div>
            <div className="text-xs font-black text-amber-300 uppercase tracking-wider">
              {fish?.name || "Ikan Samudra"} • {fish?.rarity || "RARE"}
            </div>
            <div className="text-sm font-bold text-white text-left bg-black/30 p-2.5 rounded-xl border border-white/10" dir="auto">
              {q.question_text}
            </div>
          </div>

          {/* 4 Contrast Answer Buttons */}
          <div className="grid grid-cols-1 gap-2">
            {(["A", "B", "C", "D"] as const).map((opt) => {
              const optText =
                opt === "A" ? q.option_a : opt === "B" ? q.option_b : opt === "C" ? q.option_c : q.option_d;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    dispatchAction("ANSWER_QUESTION", {
                      team: selectedTeam,
                      optionKey: opt,
                      studentId: studentIdRef.current,
                    })
                  }
                  className="p-3 rounded-2xl bg-gradient-to-r from-sky-700 to-blue-800 border-2 border-sky-300 text-white font-bold text-sm shadow-md flex items-center gap-3 active:scale-95 transition"
                >
                  <span className="w-7 h-7 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                    {opt}
                  </span>
                  <span className="text-left font-bold" dir="auto">
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center text-[10px] text-sky-400 font-mono">
          Jawab cepat untuk memasukkan ikan ke keranjang tim!
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: EKSPLORASI & JALAN (PETA 2D & NAVIGASI TUJUAN)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto bg-slate-950 text-white p-3 flex flex-col justify-between select-none">
      {/* Header Siswa & Tim */}
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-full shadow-sm"
            style={{ backgroundColor: lane.colorHex }}
          />
          <div>
            <div className="text-xs font-black text-white">{studentName}</div>
            <div className="text-[10px] text-amber-300 font-bold">{lane.label}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInventory(!showInventory)}
            className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-slate-200"
          >
            🎒 Tas ({myTeam?.fishCatches.length || 0})
          </button>
          <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
            ⭐ {myTeam?.points || 0}
          </div>
        </div>
      </header>

      {/* Mini Visual Map Preview */}
      <div className="my-2 bg-slate-900 border-2 border-amber-400/50 rounded-2xl p-3 flex items-center justify-around relative overflow-hidden">
        <CharacterAvatar
          character={selectedCharacter}
          teamColor={selectedTeam}
          size="md"
          showRibbon={false}
          isWalking={myTeam?.status === "TRAVELING"}
        />
        <div className="space-y-1">
          <div className="text-xs font-black text-amber-300">
            {myTeam?.status === "TRAVELING" ? "🚶 Sedang Melangkah..." : "📍 Lokasi Saat Ini:"}
          </div>
          <div className="text-sm font-black text-white">
            {LOCATION_COORDINATES[myTeam?.location || "START"]?.name}
          </div>
          <div className="text-[10px] text-slate-400">
            Pin Gembok: {myTeam?.pinsUnlocked || 0}/4 Terbuka
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="space-y-2">
        <div className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
          Pilih Tempat Tujuan:
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => dispatchAction("MOVE_TEAM", { team: selectedTeam, targetLocation: "KIOS" })}
            className="p-3 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 border-2 border-emerald-400 text-white font-bold text-xs flex items-center justify-between active:scale-95 transition shadow-md"
          >
            <span>🏪 Jalan ke Kios Pasar (G1)</span>
            <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
              🔒 Buka Gembok
            </span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction("MOVE_TEAM", { team: selectedTeam, targetLocation: "GERBANG_KANTIN" })}
            className="p-3 rounded-2xl bg-gradient-to-r from-purple-800 to-indigo-900 border-2 border-purple-400 text-white font-bold text-xs flex items-center justify-between active:scale-95 transition shadow-md"
          >
            <span>⛩️ Jalan ke Gerbang Kantin (G2)</span>
            <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
              🔒 Buka Gembok
            </span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction("MOVE_TEAM", { team: selectedTeam, targetLocation: "KANTIN" })}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-between active:scale-95 transition"
          >
            <span>🍲 Istirahat di Kantin Santri</span>
            <span className="text-[10px] text-slate-400">Pujasera</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => dispatchAction("MOVE_TEAM", { team: selectedTeam, targetLocation: "DERMAGA_1" })}
              className="p-3 rounded-2xl bg-gradient-to-r from-sky-700 to-blue-800 border-2 border-sky-400 text-white font-black text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-md"
            >
              <span>🎣 Mancing di Dermaga</span>
              <span className="text-[9px] text-sky-200 font-normal">Dermaga Umum</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction("MOVE_TEAM", { team: selectedTeam, targetLocation: "DERMAGA_VIP" })}
              className="p-3 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-600 border-2 border-yellow-300 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-md"
            >
              <span>👑 Dermaga VIP Emas</span>
              <span className="text-[9px] text-slate-900 font-bold">Ikan Legendaris</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Inventori / Tas Ikan */}
      {showInventory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-400 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-sm font-black text-amber-300">🎒 Keranjang Ikan Tim</div>
              <button
                type="button"
                onClick={() => setShowInventory(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Tutup
              </button>
            </div>
            {myTeam?.fishCatches && myTeam.fishCatches.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {myTeam.fishCatches.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span>🐟 {item.name}</span>
                    <span className="font-mono font-bold text-amber-300">+{item.points} PTS</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Belum ada ikan yang ditangkap. Ayo memancing di Dermaga!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 pt-2 font-mono">
        Magguru Mobile Controller • Room: {roomCode}
      </footer>
    </div>
  );
}
