"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AudioSettings = {
  enabled: boolean;
  audio_url: string | null;
  volume: number;
  play_on_dashboard: boolean;
  play_on_login: boolean;
  play_on_student: boolean;
  play_on_game: boolean;
  play_on_final: boolean;
};

type PageKey =
  | "play_on_dashboard"
  | "play_on_login"
  | "play_on_student"
  | "play_on_game"
  | "play_on_final";

function pageOf(pathname: string): PageKey | null {
  // Halaman yang TIDAK boleh ada suara (fokus belajar)
  if (pathname.startsWith("/dashboard/question-banks")) return null;
  if (pathname.startsWith("/student/materials/")) return null;

  // Halaman game (siswa dalam room)
  if (pathname.startsWith("/join/room")) return "play_on_game";

  // Halaman join form / login siswa
  if (pathname.startsWith("/student/login")) return "play_on_login";
  if (pathname.startsWith("/join")) return "play_on_login";

  // Halaman login guru
  if (pathname === "/login") return "play_on_login";

  // Halaman siswa (portal materi, dsb)
  if (pathname.startsWith("/student")) return "play_on_student";

  // Semua halaman dashboard guru
  if (pathname.startsWith("/dashboard")) return "play_on_dashboard";

  return null;
}

export function GlobalBackgroundAudio() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ready, setReady] = useState(false);

  // Fetch setting aktif sekali
  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("get_active_audio_settings");
        if (!alive) return;
        if (Array.isArray(data) && data[0]) {
          setSettings(data[0] as AudioSettings);
        }
      } catch {
        // ignore
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pageKey = pageOf(pathname);
  const shouldPlay = Boolean(
    settings?.enabled &&
      settings.audio_url &&
      pageKey &&
      settings[pageKey],
  );

  // Play / pause sesuai halaman
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = (settings?.volume ?? 50) / 100;

    if (!shouldPlay) {
      audio.pause();
      return;
    }

    const tryPlay = async () => {
      try {
        await audio.play();
        setNeedsGesture(false);
      } catch {
        setNeedsGesture(true);
      }
    };

    void tryPlay();

    const onGesture = () => {
      void tryPlay();
    };

    window.addEventListener("click", onGesture, { once: true });
    window.addEventListener("touchstart", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    return () => {
      window.removeEventListener("click", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [shouldPlay, settings?.volume, settings?.audio_url]);

  // Mute toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
  }, [muted]);

  if (!ready || !settings?.enabled || !settings.audio_url) {
    return null;
  }

  return (
    <>
      <audio ref={audioRef} src={settings.audio_url} loop preload="auto" />

      <button
        type="button"
        onClick={() => setMuted((v) => !v)}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-xl text-white shadow-lg transition hover:bg-violet-700"
        title={muted ? "تشغيل الصوت" : "إسكات الصوت"}
        aria-label={muted ? "تشغيل الصوت" : "إسكات الصوت"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {needsGesture ? (
        <div className="fixed bottom-4 left-20 z-50 rounded-2xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 shadow-lg">
          انقر في أي مكان لتشغيل الموسيقى 🎵
        </div>
      ) : null}
    </>
  );
}