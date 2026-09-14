"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Track = {
  id: string;
  name: string;
  audio_url: string;
  volume: number;
  pages: string[];
};

type PageKey = "dashboard" | "login" | "student" | "game" | "final";

function pageOf(pathname: string): PageKey | null {
  // Excluded pages — no audio (fokus belajar)
  if (pathname.startsWith("/dashboard/question-banks")) return null;
  if (pathname.startsWith("/student/materials/")) return null;
  if (pathname.startsWith("/dashboard/classes/")) return null;

  if (pathname.startsWith("/join/room")) return "game";
  if (pathname.startsWith("/student/login")) return "login";
  if (pathname.startsWith("/join")) return "login";
  if (pathname === "/login") return "login";
  if (pathname.startsWith("/student")) return "student";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return null;
}

export function GlobalBackgroundAudio() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("get_active_audio_tracks");
        if (!alive) return;
        if (Array.isArray(data)) setTracks(data as Track[]);
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
  const activeTrack = pageKey
    ? tracks.find((t) => t.pages.includes(pageKey)) ?? null
    : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeTrack) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    audio.volume = (activeTrack.volume ?? 50) / 100;

    if (audio.src !== activeTrack.audio_url) {
      audio.src = activeTrack.audio_url;
      audio.load();
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
  }, [activeTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
  }, [muted]);

  if (!ready || !activeTrack) return null;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" />

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