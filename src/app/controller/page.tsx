"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_QUESTION_DURATION_SECONDS } from "@/lib/game-engine/question-duration";

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
  const rawRoomParam = searchParams.get("room") || searchParams.get("code") || "";
  const preSelectedTeam = searchParams.get("team");

  // State for room code with live user switcher
  const [roomCode, setRoomCode] = useState<string>(() => {
    return (rawRoomParam || "HOTSEAT").toUpperCase().trim();
  });
  const [roomInput, setRoomInput] = useState<string>(() => {
    return (rawRoomParam || "HOTSEAT").toUpperCase().trim();
  });

  const [selectedTeam, setSelectedTeam] = useState<TeamSlot | null>(() => {
    return TEAMS.find((t) => t.id === preSelectedTeam) ?? null;
  });

  const [gameState, setGameState] = useState<GameStateSync>({
    phase: "lobby",
    currentQuestionIndex: 0,
    // Nilai awal sebelum sync pertama tiba; mengikuti lantai durasi soal
    // bersama (30 detik, sama seperti mode room DB).
    timerSeconds: MIN_QUESTION_DURATION_SECONDS,
    totalQuestions: 1,
    hasMyTeamAnswered: false,
    myTeamAnswer: null,
    isLocked: true,
    answeredCount: 0,
  });

  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [hasLocallyAnswered, setHasLocallyAnswered] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [, setSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const prevQIndexRef = useRef<number>(-1);
  // Sticky local answer: question index + key this team has answered, kept in
  // refs so sync payloads can be checked without re-creating callbacks.
  const answeredQIndexRef = useRef<number>(-1);
  const answeredKeyRef = useRef<string | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const realtimeChannelRef = useRef<
    ReturnType<ReturnType<typeof createClient>["channel"]> | null
  >(null);

  // Initialize Supabase browser client once
  if (!supabaseRef.current && typeof window !== "undefined") {
    try {
      supabaseRef.current = createClient();
    } catch {
      // ignore
    }
  }

  // Handle incoming game state from any source (Realtime WebSocket, BroadcastChannel, or HTTP poll)
  const handleIncomingGameState = useCallback(
    (incoming: Partial<GameStateSync> & { answeredTeams?: Record<string, { optionKey?: string }> }) => {
      setIsConnected(true);

      const nextQIndex = typeof incoming.currentQuestionIndex === "number" ? incoming.currentQuestionIndex : undefined;
      const nextPhase = incoming.phase;

      // Determine if our team has answered from either incoming.answeredTeams map or incoming.hasMyTeamAnswered
      let teamHasAnswered = false;
      let teamAnswerKey: string | null = null;

      if (incoming.answeredTeams && selectedTeam) {
        const teamRec = incoming.answeredTeams[selectedTeam.id];
        if (teamRec) {
          teamHasAnswered = true;
          teamAnswerKey = teamRec.optionKey ?? null;
        }
      } else if (typeof incoming.hasMyTeamAnswered === "boolean") {
        teamHasAnswered = incoming.hasMyTeamAnswered;
        teamAnswerKey = incoming.myTeamAnswer ?? null;
      }

      // Question progression check
      const prevQ = prevQIndexRef.current;
      const isNewQuestion = typeof nextQIndex === "number" && prevQ !== -1 && prevQ !== nextQIndex;

      if (typeof nextQIndex === "number") {
        prevQIndexRef.current = nextQIndex;
      }

      const effectiveQIndex = typeof nextQIndex === "number" ? nextQIndex : prevQ;

      // Record any server-confirmed answer for this question index so the
      // local lock can stay sticky for the rest of this question.
      if (teamHasAnswered) {
        answeredQIndexRef.current = effectiveQIndex;
        if (teamAnswerKey) {
          answeredKeyRef.current = teamAnswerKey;
        }
      }

      // Sticky lock: once this team has answered at the current question
      // index, later sync payloads for the SAME index must not unlock the
      // stick just because they (transiently) omit this team's answer.
      const stickyAnswered =
        answeredQIndexRef.current !== -1 && answeredQIndexRef.current === effectiveQIndex;
      const effectiveTeamHasAnswered = teamHasAnswered || stickyAnswered;
      const effectiveTeamAnswerKey =
        teamAnswerKey ?? (stickyAnswered ? answeredKeyRef.current : null);

      // Phases that end the game reset the local lock as well
      const isResetPhase = nextPhase === "lobby" || nextPhase === "finished";

      // Unlock cleanly only when:
      // 1. Moving to a new question, or
      // 2. The game returns to the lobby / finishes
      if ((isNewQuestion && !teamHasAnswered) || isResetPhase) {
        answeredQIndexRef.current = -1;
        answeredKeyRef.current = null;
        setHasLocallyAnswered(false);
        setLastPressedKey(null);
        setStatusMessage(null);

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([80, 40, 80]);
          } catch {}
        }
      } else if (effectiveTeamHasAnswered) {
        setHasLocallyAnswered(true);
        if (effectiveTeamAnswerKey) {
          setLastPressedKey(effectiveTeamAnswerKey);
        }
      }

      setGameState((prev) => {
        const qIdx = typeof nextQIndex === "number" ? nextQIndex : prev.currentQuestionIndex;
        const phase = nextPhase ?? prev.phase;
        const isLocked = phase !== "question" || effectiveTeamHasAnswered;

        return {
          ...prev,
          ...incoming,
          phase,
          currentQuestionIndex: qIdx,
          timerSeconds: typeof incoming.timerSeconds === "number" ? incoming.timerSeconds : prev.timerSeconds,
          totalQuestions: typeof incoming.totalQuestions === "number" ? incoming.totalQuestions : prev.totalQuestions,
          hasMyTeamAnswered: effectiveTeamHasAnswered,
          myTeamAnswer: effectiveTeamAnswerKey ?? (effectiveTeamHasAnswered ? prev.myTeamAnswer : null),
          isLocked,
        };
      });
    },
    [selectedTeam],
  );

  // 1. SUPABASE REALTIME BROADCAST CHANNEL (Primary - Instant <40ms WebSocket sync across devices)
  useEffect(() => {
    if (!selectedTeam || !roomCode) return;

    const supabase = supabaseRef.current;
    if (!supabase) return;

    const channelName = `magguru_room_ctrl_${roomCode.toUpperCase()}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "projector_sync" }, ({ payload }) => {
        if (!payload) return;
        handleIncomingGameState(payload as Partial<GameStateSync>);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeChannelRef.current = channel;
          setIsConnected(true);
          // Send initial heartbeat to register with teacher's projector
          void channel.send({
            type: "broadcast",
            event: "controller_heartbeat",
            payload: { roomCode, teamId: selectedTeam.id, timestamp: Date.now() },
          });
        }
      });

    // Periodic heartbeat via Supabase channel every 3s
    const hbInterval = window.setInterval(() => {
      void channel.send({
        type: "broadcast",
        event: "controller_heartbeat",
        payload: { roomCode, teamId: selectedTeam.id, timestamp: Date.now() },
      });
    }, 3000);

    return () => {
      window.clearInterval(hbInterval);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      void channel.unsubscribe();
    };
  }, [selectedTeam, roomCode, handleIncomingGameState]);

  // 2. BROWSER BROADCAST CHANNEL (Secondary - 0ms sync for same-origin tabs/windows)
  useEffect(() => {
    if (!selectedTeam || !roomCode || typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`magguru_bc_${roomCode.toUpperCase()}`);
      bc.onmessage = (ev) => {
        if (ev.data?.event === "projector_sync" && ev.data?.payload) {
          handleIncomingGameState(ev.data.payload as Partial<GameStateSync>);
        }
      };

      // Announce heartbeat
      bc.postMessage({
        event: "controller_heartbeat",
        payload: { roomCode, teamId: selectedTeam.id, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return () => {
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, [selectedTeam, roomCode, handleIncomingGameState]);

  // 3. HTTP REST POLLING (Tertiary Fallback)
  useEffect(() => {
    if (!selectedTeam || !roomCode) return;

    let isSubscribed = true;

    const pollStateAndHeartbeat = async () => {
      try {
        const res = await fetch(
          `/api/projector/controller?roomCode=${encodeURIComponent(roomCode)}&teamId=${encodeURIComponent(selectedTeam.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("HTTP error");

        const data = await res.json();
        if (!isSubscribed) return;

        if (data.gameState) {
          handleIncomingGameState(data.gameState);
        }
      } catch {
        // HTTP polling silent fallback
      }
    };

    void pollStateAndHeartbeat();
    const interval = window.setInterval(pollStateAndHeartbeat, 600);

    return () => {
      isSubscribed = false;
      window.clearInterval(interval);
    };
  }, [selectedTeam, roomCode, handleIncomingGameState]);

  // Handle pressing a gamepad button
  const handlePressButton = useCallback(
    async (optionKey: string) => {
      const now = Date.now();
      // Guard against rapid duplicate taps within 250ms
      if (now - lastTapTimeRef.current < 250) return;
      lastTapTimeRef.current = now;

      if (!selectedTeam) return;

      // Friendly validation feedback instead of dead silent button
      if (hasLocallyAnswered || gameState.hasMyTeamAnswered) {
        setStatusMessage(`🔒 Jawaban tim Anda sudah terkunci (${lastPressedKey || gameState.myTeamAnswer || optionKey})!`);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(30); } catch {}
        }
        return;
      }

      if (gameState.phase !== "question") {
        if (gameState.phase === "lobby") {
          setStatusMessage("⏳ Menunggu Guru memulai kuis di layar proyektor!");
        } else if (gameState.phase === "reveal") {
          setStatusMessage("💡 Waktu menjawab ditutup! Perhatikan kunci jawaban di proyektor.");
        } else {
          setStatusMessage("⏳ Belum waktu menjawab!");
        }
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(30); } catch {}
        }
        return;
      }

      // Haptic confirmation
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }

      // Instant optimistic local lock (sticky for this question index)
      setHasLocallyAnswered(true);
      setLastPressedKey(optionKey);
      answeredQIndexRef.current = gameState.currentQuestionIndex;
      answeredKeyRef.current = optionKey;
      setSubmitting(true);
      setStatusMessage(`Mengunci pilihan ${optionKey}...`);

      const pressPayload = {
        roomCode,
        teamId: selectedTeam.id,
        playerName: selectedTeam.name,
        optionKey,
        action: "press",
        timestamp: Date.now(),
      };

      // 1. BROADCAST VIA SUPABASE REALTIME (INSTANT WEBSOCKET TO TEACHER'S PROJECTOR)
      try {
        const channel = realtimeChannelRef.current;
        if (channel) {
          void channel.send({
            type: "broadcast",
            event: "controller_press",
            payload: pressPayload,
          });
        }
      } catch {
        // ignore
      }

      // 2. BROADCAST VIA BROWSER BROADCAST CHANNEL (INSTANT SAME-ORIGIN)
      try {
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const bc = new BroadcastChannel(`magguru_bc_${roomCode.toUpperCase()}`);
          bc.postMessage({
            event: "controller_press",
            payload: pressPayload,
          });
          bc.close();
        }
      } catch {
        // ignore
      }

      // 3. POST TO HTTP REST API (FALLBACK + PERSISTENCE)
      try {
        const res = await fetch("/api/projector/controller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pressPayload),
        });

        const result = await res.json();

        if (res.ok && result.success) {
          setStatusMessage(`✓ Jawaban ${optionKey} TERKUNCI! Menunggu tim lain & proyektor...`);
        } else if (result.error === "ALREADY_ANSWERED") {
          setStatusMessage(`🔒 Jawaban tim sudah terkunci sebelumnya (${result.existingAnswer || optionKey}).`);
        } else {
          setStatusMessage(`✓ Pilihan ${optionKey} terkirim.`);
        }
      } catch {
        setStatusMessage(`✓ Pilihan ${optionKey} disiarkan via WebSocket.`);
      } finally {
        setSubmitting(false);
      }
    },
    [selectedTeam, hasLocallyAnswered, gameState.hasMyTeamAnswered, gameState.phase, gameState.myTeamAnswer, gameState.currentQuestionIndex, lastPressedKey, roomCode],
  );

  // 1. SELECT TEAM CONTROLLER SLOT
  if (!selectedTeam) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="text-5xl animate-bounce">🎮</div>
          <div>
            <h1 className="text-2xl font-black">Kontroler HP Siswa</h1>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan HP Anda sebagai Stik Remote Nirkabel untuk menjawab langsung di layar proyektor kelas!
            </p>
          </div>

          {/* Room Code Card with Easy Switcher */}
          <div className="rounded-2xl bg-white/10 p-3.5 border border-white/15 text-start space-y-2 backdrop-blur">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Kode Ruangan Proyektor:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                value={roomInput}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().trim();
                  setRoomInput(val);
                  setRoomCode(val || "HOTSEAT");
                }}
                placeholder="Contoh: 5C87B2 atau HOTSEAT"
                className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-amber-300 font-mono font-black text-sm uppercase tracking-wider focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setRoomCode(roomInput || "HOTSEAT")}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black transition"
              >
                Set
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Pastikan kode ruangan ini sama persis dengan yang tampil di layar proyektor guru.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            <span className="text-xs font-black uppercase text-slate-400 block text-start">
              Pilih Stik Tim Anda:
            </span>
            {TEAMS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTeam(t)}
                className={`w-full p-4 rounded-2xl bg-gradient-to-r ${t.bgGradient} font-black text-white text-base flex items-center justify-between shadow-xl transition active:scale-95 border-2 border-white/20 hover:brightness-110`}
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

  const isAnswered = hasLocallyAnswered || gameState.hasMyTeamAnswered;
  const isQuestionPhase = gameState.phase === "question";

  // 2. ACTIVE GAMEPAD CONTROLLER SCREEN
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-between max-w-md mx-auto select-none touch-manipulation">
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
              answeredQIndexRef.current = -1;
              answeredKeyRef.current = null;
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

            {isAnswered ? (
              <div className="rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 p-3.5 text-xs font-black text-emerald-300 shadow-lg animate-in zoom-in-95">
                <span className="text-lg block mb-0.5">🔒</span>
                <div>JAWABAN TERKUNCI: Pilihan {lastPressedKey || gameState.myTeamAnswer}</div>
                <p className="text-[11px] font-normal text-emerald-200/80 mt-0.5">
                  Remote Anda telah dikunci. Jawaban tidak bisa diubah hingga soal berikutnya.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHasLocallyAnswered(false);
                    setLastPressedKey(null);
                    setStatusMessage(null);
                    setGameState((prev) => ({
                      ...prev,
                      hasMyTeamAnswered: false,
                      myTeamAnswer: null,
                      isLocked: prev.phase !== "question",
                    }));
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/50 px-3 py-1 text-[11px] font-bold text-white transition active:scale-95"
                >
                  🔄 Buka Kunci (Jika Sudah Pindah Soal)
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-500/20 border border-amber-400/50 p-2.5 text-xs font-bold text-amber-200 animate-pulse">
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
          <div className="text-[11px] font-mono text-slate-200 bg-black/60 px-3 py-1.5 rounded-xl inline-block border border-white/20 shadow-md">
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
          const isButtonDisabledVisual = isAnswered || !isQuestionPhase;

          return (
            <button
              key={btn.key}
              type="button"
              aria-disabled={isButtonDisabledVisual}
              onPointerDown={(e) => {
                e.preventDefault();
                void handlePressButton(btn.key);
              }}
              onClick={() => void handlePressButton(btn.key)}
              className={`h-36 rounded-3xl p-4 flex flex-col items-center justify-center font-black text-white bg-gradient-to-b ${btn.color} border-4 ${btn.border} shadow-2xl transition-all duration-150 relative overflow-hidden select-none cursor-pointer active:scale-90 active:brightness-125 ${
                isButtonDisabledVisual
                  ? isSelected
                    ? "ring-4 ring-white scale-95 opacity-100 brightness-110 shadow-emerald-500/50"
                    : "opacity-40 grayscale-[40%] hover:opacity-50"
                  : "hover:scale-105 active:scale-95 shadow-lg"
              }`}
            >
              <span className="text-4xl drop-shadow-md">{btn.icon}</span>
              <span className="text-2xl font-black mt-1">Pilihan {btn.key}</span>
              <span className="text-[11px] font-mono opacity-90 uppercase tracking-wider mt-0.5">
                {btn.label}
              </span>

              {isSelected && (
                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white text-slate-950 font-black text-sm flex items-center justify-center shadow-lg animate-in zoom-in-75">
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
