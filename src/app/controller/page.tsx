"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

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

export default function ControllerPage() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") || "HOTSEAT").toUpperCase();
  const preSelectedTeam = searchParams.get("team");

  const [selectedTeam, setSelectedTeam] = useState<TeamSlot | null>(() => {
    return TEAMS.find((t) => t.id === preSelectedTeam) ?? null;
  });

  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Send heartbeat immediately on connect/select, then every 4s
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
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 4000);
    return () => window.clearInterval(interval);
  }, [selectedTeam, roomCode]);

  // Handle pressing a gamepad button
  const handlePressButton = useCallback(
    async (optionKey: string) => {
      if (!selectedTeam || submitting) return;

      // Haptic feedback if supported on mobile
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(60);
        } catch {
          // ignore
        }
      }

      setLastPressedKey(optionKey);
      setSubmitting(true);
      setStatusMessage(`Mengirim tombol ${optionKey} ke proyektor... 📡`);

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

        if (res.ok) {
          setStatusMessage(`Tombol ${optionKey} berhasil tampil di proyektor! 🚀`);
        } else {
          setStatusMessage("Gagal terhubung ke proyektor. Coba lagi.");
        }
      } catch {
        setStatusMessage("Koneksi terputus. Pastikan terhubung ke jaringan.");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedTeam, submitting, roomCode],
  );

  // 1. SELECT TEAM CONTROLLER SLOT
  if (!selectedTeam) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl animate-bounce">🎮</div>
          <h1 className="text-2xl font-black">Kontroler HP Siswa</h1>
          <p className="text-xs text-slate-400">
            Hubungkan HP Anda sebagai remote game untuk tampil langsung di layar proyektor!
          </p>
          <div className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 inline-block">
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
        </div>
      </main>
    );
  }

  // 2. ACTIVE GAMEPAD CONTROLLER SCREEN
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white flex flex-col justify-between max-w-md mx-auto select-none">
      {/* Controller Header */}
      <header className="rounded-2xl p-4 bg-white/5 border border-white/10 backdrop-blur shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-slate-300">
              {isConnected ? "TERHUBUNG KE PROYEKTOR" : "MENGHUBUNGKAN..."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTeam(null)}
            className="text-[11px] font-bold text-slate-400 hover:text-white underline"
          >
            Ganti Stik
          </button>
        </div>

        <div className={`mt-3 rounded-xl p-3 bg-gradient-to-r ${selectedTeam.bgGradient} text-white font-black flex items-center justify-between shadow-lg`}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">{selectedTeam.badge}</div>
            <div className="text-base truncate">{selectedTeam.name}</div>
          </div>
          <div className="text-2xl">🎮</div>
        </div>
      </header>

      {/* Central Notification Area */}
      <div className="my-4 text-center">
        {statusMessage ? (
          <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/40 p-3 text-xs font-bold text-emerald-300 animate-in zoom-in-95">
            {statusMessage}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Tekan salah satu tombol di bawah untuk menendang bola / menebas buah di layar proyektor!
          </p>
        )}
      </div>

      {/* 4 BIG TACTILE CONSOLE BUTTONS */}
      <section className="grid grid-cols-2 gap-4 pb-4">
        {[
          { key: "A", label: "A / Bola 1", icon: "⚽", color: "from-rose-600 to-red-700", border: "border-rose-400" },
          { key: "B", label: "B / Bola 2", icon: "⚽", color: "from-sky-600 to-blue-700", border: "border-sky-400" },
          { key: "C", label: "C / Bola 3", icon: "⚽", color: "from-emerald-600 to-teal-700", border: "border-emerald-400" },
          { key: "D", label: "D / Bola 4", icon: "⚽", color: "from-amber-500 to-yellow-600", border: "border-amber-400" },
        ].map((btn) => {
          const isSelected = lastPressedKey === btn.key;

          return (
            <button
              key={btn.key}
              type="button"
              disabled={submitting}
              onClick={() => void handlePressButton(btn.key)}
              className={`h-36 rounded-3xl p-4 flex flex-col items-center justify-center font-black text-white bg-gradient-to-b ${btn.color} border-4 ${btn.border} shadow-2xl transition-all duration-150 active:scale-90 active:brightness-125 cursor-pointer relative overflow-hidden ${
                isSelected ? "ring-4 ring-white scale-95" : ""
              }`}
            >
              <span className="text-4xl drop-shadow-lg">{btn.icon}</span>
              <span className="text-2xl font-black mt-1">{btn.key}</span>
              <span className="text-[10px] font-mono opacity-80 uppercase tracking-widest mt-0.5">
                {btn.label}
              </span>
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
