"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { isSouqFishingEnabled } from "@/modules/souq-fishing/bridge/magguru-bridge";
import { ControllerShell as SouqFishingControllerShell } from "@/modules/souq-fishing/ui/controller";
import { createInitialWorldState } from "@/modules/souq-fishing/engine/world";
import type { TeamColor } from "@/modules/souq-fishing/engine/types";

type TeamSlot = {
  id: string;
  name: string;
  color: string;
  bgGradient: string;
  badge: string;
};

const TEAMS: TeamSlot[] = [
  { id: "team-1", name: "Tim Merah (الفريق الأحمر)", color: "text-rose-400", bgGradient: "from-rose-600 to-red-700", badge: "🔴 Stik 1" },
  { id: "team-2", name: "Tim Biru (الفريق الأزرق)", color: "text-sky-400", bgGradient: "from-sky-600 to-blue-700", badge: "🔵 Stik 2" },
  { id: "team-3", name: "Tim Hijau (الفريق الأخضر)", color: "text-emerald-400", bgGradient: "from-emerald-600 to-teal-700", badge: "🟢 Stik 3" },
  { id: "team-4", name: "Tim Kuning (الفريق الأصفر)", color: "text-amber-400", bgGradient: "from-amber-500 to-yellow-600", badge: "🟡 Stik 4" },
];

interface GameStateSync {
  phase: "lobby" | "question" | "reveal" | "leaderboard" | "finished";
  currentQuestionIndex: number;
  timerSeconds: number;
  totalQuestions: number;
  questionText?: string;
  hasMyTeamAnswered: boolean;
  myTeamAnswer: string | null;
  isLocked: boolean;
  answeredCount: number;
}

export default function ControllerPage() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") || searchParams.get("code") || "HOTSEAT").toUpperCase();
  const preSelectedTeam = searchParams.get("team");

  const [selectedTeam, setSelectedTeam] = useState<TeamSlot | null>(() => {
    return TEAMS.find((t) => t.id === preSelectedTeam) ?? null;
  });

  const [gameState, setGameState] = useState<GameStateSync>({
    phase: "lobby",
    currentQuestionIndex: 0,
    timerSeconds: 20,
    totalQuestions: 1,
    hasMyTeamAnswered: false,
    myTeamAnswer: null,
    isLocked: true,
    answeredCount: 0,
  });

  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [hasLocallyAnswered, setHasLocallyAnswered] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const prevQIndexRef = useRef<number>(-1);

  // Poll state and heartbeat from server every 400ms
  useEffect(() => {
    if (!selectedTeam) return;

    let isSubscribed = true;

    const pollStateAndHeartbeat = async () => {
      try {
        const res = await fetch(
          `/api/projector/controller?roomCode=${encodeURIComponent(roomCode)}&teamId=${encodeURIComponent(selectedTeam.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Network response not ok");

        const data = await res.json();
        if (!isSubscribed) return;

        setIsConnected(true);

        if (data.gameState) {
          const gs: GameStateSync = data.gameState;
          setGameState(gs);

          // Detect new question progression from projector
          if (prevQIndexRef.current !== -1 && prevQIndexRef.current !== gs.currentQuestionIndex) {
            // New question arrived: reset local lock!
            setHasLocallyAnswered(false);
            setLastPressedKey(null);
            setStatusMessage(null);

            // Haptic vibration to signal new question
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try {
                navigator.vibrate([80, 40, 80]);
              } catch {
                // ignore
              }
            }
          }
          prevQIndexRef.current = gs.currentQuestionIndex;

          // If server confirmed our team has answered, lock locally as well
          if (gs.hasMyTeamAnswered && !hasLocallyAnswered) {
            setHasLocallyAnswered(true);
            if (gs.myTeamAnswer) {
              setLastPressedKey(gs.myTeamAnswer);
            }
          }
        }
      } catch {
        if (isSubscribed) {
          setIsConnected(false);
        }
      }
    };

    void pollStateAndHeartbeat();
    const interval = window.setInterval(pollStateAndHeartbeat, 400);

    return () => {
      isSubscribed = false;
      window.clearInterval(interval);
    };
  }, [selectedTeam, roomCode, hasLocallyAnswered]);

  // Send separate heartbeat every 5s to keep controller connection registered
  useEffect(() => {
    if (!selectedTeam) return;

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/projector/controller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode,
            teamId: selectedTeam.id,
            action: "heartbeat",
          }),
        });
      } catch {
        // silent catch
      }
    };

    const interval = window.setInterval(sendHeartbeat, 5000);
    return () => window.clearInterval(interval);
  }, [selectedTeam, roomCode]);

  // Handle pressing a gamepad button
  const handlePressButton = useCallback(
    async (optionKey: string) => {
      // STRICT LOCKOUT: cannot press if already answered, submitting, or not in question phase
      if (!selectedTeam || submitting || hasLocallyAnswered || gameState.phase !== "question" || gameState.isLocked) {
        return;
      }

      // Haptic feedback if supported on mobile
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(60);
        } catch {
          // ignore
        }
      }

      // Instant local lock: disable further taps immediately
      setHasLocallyAnswered(true);
      setLastPressedKey(optionKey);
      setSubmitting(true);
      setStatusMessage(`Mengunci pilihan ${optionKey}...`);

      try {
        const res = await fetch("/api/projector/controller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode,
            teamId: selectedTeam.id,
            playerName: selectedTeam.name,
            optionKey,
            action: "press",
          }),
        });

        const result = await res.json();

        if (res.ok && result.success) {
          setStatusMessage(`✓ Jawaban ${optionKey} TERKUNCI! Menunggu tim lain & proyektor...`);
        } else if (result.error === "ALREADY_ANSWERED") {
          setStatusMessage(`🔒 Jawaban tim sudah terkunci sebelumnya (${result.existingAnswer || optionKey}).`);
        } else if (result.error === "LOCKED_PHASE") {
          setStatusMessage("🔒 Waktu menjawab sudah ditutup oleh sistem.");
        } else {
          setStatusMessage(result.message || "Gagal mengunci jawaban. Coba lagi.");
        }
      } catch {
        setStatusMessage("Koneksi terputus. Pastikan terhubung ke WiFi/jaringan.");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedTeam, submitting, hasLocallyAnswered, gameState.phase, gameState.isLocked, roomCode],
  );

  // Souq & Fishing Game Module Mount (Additive-Only)
  const themeParam = searchParams.get("theme") || searchParams.get("game_theme");
  if (
    isSouqFishingEnabled() &&
    (themeParam === "souq_fishing" || themeParam === "souq-fishing")
  ) {
    const rawTeam = (searchParams.get("team") || "MERAH").toUpperCase();
    const currentTeamColor: TeamColor = (
      ["MERAH", "BIRU", "KUNING", "HIJAU"] as const
    ).includes(rawTeam as TeamColor)
      ? (rawTeam as TeamColor)
      : "MERAH";
    const worldState = createInitialWorldState();
    return (
      <SouqFishingControllerShell
        worldState={worldState}
        currentTeamColor={currentTeamColor}
      />
    );
  }

  // 1. SELECT TEAM CONTROLLER SLOT
  if (!selectedTeam) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl animate-bounce">🎮</div>
          <h1 className="text-2xl font-black">Kontroler HP Siswa</h1>
          <p className="text-xs text-slate-400">
            Hubungkan HP Anda sebagai remote game untuk menekan jawaban langsung di layar proyektor!
          </p>
          <div className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 inline-block border border-white/10">
            Ruangan: {roomCode}
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-xs font-black uppercase text-slate-400 block text-start">
              Pilih Kontroler Tim Anda:
            </span>
            {TEAMS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTeam(t)}
                className={`w-full p-4 rounded-2xl bg-gradient-to-r ${t.bgGradient} font-black text-white text-lg flex items-center justify-between shadow-xl transition active:scale-95 border-2 border-white/20`}
              >
                <span>{t.badge}</span>
                <span className="text-sm truncate">{t.name}</span>
                <span>→</span>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/join"
              className="text-xs text-slate-400 hover:text-white underline block"
            >
              ← Masuk via Halaman Gabung Ruang Biasa
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isButtonsDisabled =
    hasLocallyAnswered ||
    gameState.hasMyTeamAnswered ||
    gameState.phase !== "question" ||
    submitting;

  // 2. ACTIVE GAMEPAD CONTROLLER SCREEN
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-between max-w-md mx-auto select-none">
      {/* Controller Header */}
      <header className="rounded-2xl p-4 bg-white/5 border border-white/10 backdrop-blur shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-3 w-3 rounded-full ${
                isConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500 animate-pulse"
              }`}
            />
            <span className="text-[11px] font-mono font-bold text-slate-300">
              {isConnected ? "TERHUBUNG KE PROYEKTOR" : "KONEKSI TERPUTUS..."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedTeam(null);
              setHasLocallyAnswered(false);
              setLastPressedKey(null);
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-white underline"
          >
            Ganti Tim
          </button>
        </div>

        <div
          className={`mt-3 rounded-xl p-3 bg-gradient-to-r ${selectedTeam.bgGradient} text-white font-black flex items-center justify-between shadow-lg`}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">{selectedTeam.badge}</div>
            <div className="text-base truncate">{selectedTeam.name}</div>
          </div>
          <div className="text-right font-mono">
            <div className="text-[10px] opacity-80">ROOM</div>
            <div className="text-xs font-black text-amber-300">{roomCode}</div>
          </div>
        </div>
      </header>

      {/* Central Game State & Lock Banner */}
      <div className="my-3 text-center space-y-2">
        {gameState.phase === "lobby" && (
          <div className="rounded-2xl bg-indigo-500/20 border border-indigo-400/40 p-3.5 text-xs font-bold text-indigo-200 animate-pulse">
            <span className="text-base block mb-1">⏳</span>
            <span>Menunggu Guru Memulai Kuis di Layar Proyektor...</span>
          </div>
        )}

        {gameState.phase === "question" && (
          <>
            <div className="flex items-center justify-between px-2 text-xs font-mono font-bold text-slate-400">
              <span>Soal {gameState.currentQuestionIndex + 1} / {gameState.totalQuestions}</span>
              <span className={`px-2 py-0.5 rounded-lg border ${
                gameState.timerSeconds <= 5 ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse" : "bg-black/40 text-amber-300 border-white/10"
              }`}>
                ⏱️ {gameState.timerSeconds}s
              </span>
            </div>

            {hasLocallyAnswered || gameState.hasMyTeamAnswered ? (
              <div className="rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 p-3.5 text-xs font-black text-emerald-300 shadow-lg animate-in zoom-in-95">
                <span className="text-lg block mb-0.5">🔒</span>
                <div>JAWABAN TERKUNCI: Pilihan {lastPressedKey || gameState.myTeamAnswer}</div>
                <p className="text-[11px] font-normal text-emerald-200/80 mt-0.5">
                  Remote Anda telah dikunci. Jawaban tidak bisa diubah hingga soal berikutnya.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-500/20 border border-amber-400/50 p-2.5 text-xs font-bold text-amber-200">
                ⚡ Tekan salah satu tombol di bawah untuk menjawab sekarang!
              </div>
            )}
          </>
        )}

        {gameState.phase === "reveal" && (
          <div className="rounded-2xl bg-amber-500/20 border border-amber-400/60 p-3.5 text-xs font-black text-amber-200">
            <span className="text-lg block mb-0.5">💡</span>
            <div>WAKTU MENJAWAB DITUTUP!</div>
            <p className="text-[11px] font-normal text-amber-100/90 mt-0.5">
              Perhatikan pembahasan dan kunci jawaban di layar proyektor.
            </p>
          </div>
        )}

        {gameState.phase === "leaderboard" && (
          <div className="rounded-2xl bg-purple-500/20 border border-purple-400/60 p-3.5 text-xs font-black text-purple-200">
            <span className="text-lg block mb-0.5">🏆</span>
            <div>PAPAN KLASEMEN SEMENTARA</div>
            <p className="text-[11px] font-normal text-purple-100/90 mt-0.5">
              Lihat perolehan skor dan peringkat tim Anda di layar proyektor.
            </p>
          </div>
        )}

        {gameState.phase === "finished" && (
          <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/60 p-4 text-xs font-black text-emerald-200">
            <span className="text-2xl block mb-1">🎉</span>
            <div className="text-sm">PERMAINAN SELESAI!</div>
            <p className="text-[11px] font-normal text-emerald-100/90 mt-1">
              Lihat podium juara di layar proyektor kelas!
            </p>
          </div>
        )}

        {statusMessage && (
          <div className="text-[11px] font-mono text-slate-300 bg-black/40 px-3 py-1 rounded-xl inline-block border border-white/10">
            {statusMessage}
          </div>
        )}
      </div>

      {/* 4 BIG TACTILE CONSOLE BUTTONS */}
      <section className="grid grid-cols-2 gap-4 pb-4">
        {[
          { key: "A", label: "A / Segitiga", icon: "▲", color: "from-rose-600 to-red-700", border: "border-rose-400" },
          { key: "B", label: "B / Ketupat", icon: "◆", color: "from-sky-600 to-blue-700", border: "border-sky-400" },
          { key: "C", label: "C / Lingkaran", icon: "●", color: "from-amber-500 to-yellow-600", border: "border-amber-400" },
          { key: "D", label: "D / Kotak", icon: "■", color: "from-emerald-600 to-teal-700", border: "border-emerald-400" },
        ].map((btn) => {
          const isSelected = lastPressedKey === btn.key || gameState.myTeamAnswer === btn.key;

          return (
            <button
              key={btn.key}
              type="button"
              disabled={isButtonsDisabled}
              onClick={() => void handlePressButton(btn.key)}
              className={`h-36 rounded-3xl p-4 flex flex-col items-center justify-center font-black text-white bg-gradient-to-b ${btn.color} border-4 ${btn.border} shadow-2xl transition-all duration-150 relative overflow-hidden ${
                isButtonsDisabled
                  ? isSelected
                    ? "ring-4 ring-white scale-95 opacity-100 brightness-110"
                    : "opacity-40 grayscale-[50%] cursor-not-allowed"
                  : "active:scale-90 active:brightness-125 cursor-pointer hover:scale-105"
              }`}
            >
              <span className="text-4xl drop-shadow-md">{btn.icon}</span>
              <span className="text-2xl font-black mt-1">Pilihan {btn.key}</span>
              <span className="text-[11px] font-mono opacity-90 uppercase tracking-wider mt-0.5">
                {btn.label}
              </span>

              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </section>

      {/* Footer Info */}
      <footer className="text-center text-[10px] text-slate-500 pb-2">
        Magguru Wireless Console Controller • Ruangan: {roomCode}
      </footer>
    </main>
  );
}
