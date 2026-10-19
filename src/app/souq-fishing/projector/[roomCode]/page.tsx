"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { ProjectorWorldMap } from "@/modules/souq-fishing/standalone/components/projector-world-map";
import { ProjectorFourTeamTables } from "@/modules/souq-fishing/standalone/components/projector-four-team-tables";
import { createDefaultRoomState } from "@/modules/souq-fishing/standalone/engine";
import type {
  StandaloneRoomState,
  TeamColor,
  LocationId,
} from "@/modules/souq-fishing/standalone/types";

export default function SouqFishingProjectorPage() {
  const params = useParams();
  const roomCode = ((params?.roomCode as string) || "SOUQ01").toUpperCase();

  const [room, setRoom] = useState<StandaloneRoomState>(() =>
    createDefaultRoomState(roomCode)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const bcRef = useRef<BroadcastChannel | null>(null);

  // Audio synthesis for instant feedback (No external asset dependency)
  const playSound = useCallback(
    (type: "move" | "correct" | "fish" | "wrong") => {
      if (!soundEnabled || typeof window === "undefined") return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === "correct" || type === "fish") {
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === "move") {
          osc.frequency.setValueAtTime(329.63, now); // E4
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.1); // A4
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
        } else {
          osc.frequency.setValueAtTime(220, now); // A3
          osc.frequency.setValueAtTime(180, now + 0.1);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        }
      } catch {
        // audio context blocked by autoplay policy until interaction
      }
    },
    [soundEnabled]
  );

  // Fetch latest room state from API
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
      // ignore network glitch in polling
    }
  }, [roomCode]);

  // Dispatch Action Helper
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
            // Broadcast across tabs for zero-latency same-machine play
            bcRef.current?.postMessage({ type: "ROOM_UPDATED", room: data.room });
          }
        }
      } catch (err) {
        console.error("Action error:", err);
      }
    },
    [roomCode]
  );

  // Initialize BroadcastChannel and Fast Polling (600ms)
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

  // Interactive Action Handlers
  const handleTeamMove = useCallback(
    (team: TeamColor, targetLocation: LocationId) => {
      playSound("move");
      dispatchAction("MOVE_TEAM", { team, targetLocation });
    },
    [dispatchAction, playSound]
  );

  const handleOpenGateChallenge = useCallback(
    (team: TeamColor) => {
      playSound("move");
      dispatchAction("START_GATE", { team });
    },
    [dispatchAction, playSound]
  );

  const handleStartFishingChallenge = useCallback(
    (team: TeamColor) => {
      playSound("fish");
      const isVip = room.teams[team]?.location === "DERMAGA_VIP";
      dispatchAction("START_FISHING", { team, isVip });
    },
    [dispatchAction, playSound, room.teams]
  );

  const handleAnswerQuestion = useCallback(
    (team: TeamColor, optionKey: "A" | "B" | "C" | "D") => {
      const tm = room.teams[team];
      const isCorrect = tm?.currentQuestion?.correct_option === optionKey;
      playSound(isCorrect ? "correct" : "wrong");
      dispatchAction("ANSWER_QUESTION", { team, optionKey });
    },
    [dispatchAction, playSound, room.teams]
  );

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-hidden bg-slate-950 text-white flex flex-col select-none">
      {/* Top Header Overlay Bar */}
      <header className="h-[6vh] min-h-[40px] max-h-[50px] bg-slate-950/90 backdrop-blur-md border-b border-amber-400/40 px-4 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-teal-600 flex items-center justify-center text-lg shadow-md border border-white/30">
            🎣
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
              <span>EKSPEDISI PASAR & DERMAGA PANCING</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-widest font-mono">
                Layar Proyektor Fullscreen
              </span>
            </h1>
          </div>
        </div>

        {/* Center Room Code Pill */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            KODE ROOM:
          </span>
          <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-mono font-black text-sm tracking-widest shadow-lg border border-white/50">
            {roomCode}
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline ml-2 font-mono">
            Siswa gabung di: <strong className="text-amber-300">/souq-fishing/play/{roomCode}</strong>
          </span>
        </div>

        {/* Right Tools Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-200 border border-white/10 transition"
            title="Toggle Efek Suara"
          >
            {soundEnabled ? "🔊 Suara: ON" : "🔇 Suara: OFF"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition shadow-md"
            title="Layar Penuh"
          >
            {isFullscreen ? "🗗 Keluar Fullscreen" : "⛶ Layar Penuh"}
          </button>
        </div>
      </header>

      {/* Baris Atas Proyektor: 58vh ProjectorWorldMap */}
      <section className="h-[56vh] w-full relative shrink-0">
        <ProjectorWorldMap
          teams={room.teams}
          onLocationClick={(loc) => {
            // Default clicking a location prompts red team
            handleTeamMove("MERAH", loc);
          }}
          onTeamMove={handleTeamMove}
        />
      </section>

      {/* Baris Bawah Proyektor: 42vh ProjectorFourTeamTables dengan Active Tilt */}
      <section className="flex-1 w-full min-h-0 relative">
        <ProjectorFourTeamTables
          teams={room.teams}
          onAnswerQuestion={handleAnswerQuestion}
          onOpenGateChallenge={handleOpenGateChallenge}
          onStartFishingChallenge={handleStartFishingChallenge}
        />
      </section>
    </div>
  );
}
