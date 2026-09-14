"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BG_AUDIO_PAUSE_EVENT,
  BG_AUDIO_RESUME_EVENT,
} from "@/lib/bg-audio-events";

type Track = {
  id: string;
  name: string;
  audio_url: string;
  volume: number;
  pages: string[];
};

type PageKey = "dashboard" | "login" | "student" | "game" | "final";

function pageOf(pathname: string): PageKey | null {
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
  const [mounted, setMounted] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [userMuted, setUserMuted] = useState(false);
  const [pausedByEvent, setPausedByEvent] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted]);

  useEffect(() => {
    const onPause = () => setPausedByEvent(true);
    const onResume = () => setPausedByEvent(false);

    window.addEventListener(BG_AUDIO_PAUSE_EVENT, onPause);
    window.addEventListener(BG_AUDIO_RESUME_EVENT, onResume);

    return () => {
      window.removeEventListener(BG_AUDIO_PAUSE_EVENT, onPause);
      window.removeEventListener(BG_AUDIO_RESUME_EVENT, onResume);
    };
  }, []);

  const pageKey = pageOf(pathname);
  const activeTrack = pageKey
    ? tracks.find((t) => t.pages.includes(pageKey)) ?? null
    : null;

  useEffect(() => {
    if (!mounted) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeTrack || pausedByEvent) {
      audio.pause();
      if (!activeTrack) {
        audio.removeAttribute("src");
        try {
          audio.load();
        } catch {
          // ignore
        }
        setNeedsGesture(false);
      }
      return;
    }

    audio.volume = (activeTrack.volume ?? 50) / 100;
    audio.muted = userMuted;

    if (!audio.src || !audio.src.endsWith(activeTrack.audio_url)) {
      audio.src = activeTrack.audio_url;
      audio.load();
    }

    let attached = false;

    const removeGestureHandlers = () => {
      if (!attached) return;
      window.removeEventListener("click", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("scroll", onGesture);
      window.removeEventListener("pointerdown", onGesture);
      attached = false;
    };

    const tryPlay = async (): Promise<boolean> => {
      try {
        await audio.play();
        setNeedsGesture(false);
        removeGestureHandlers();
        return true;
      } catch {
        setNeedsGesture(true);
        return false;
      }
    };

    const onGesture = () => {
      void tryPlay();
    };

    const attachGestureHandlers = () => {
      if (attached) return;
      window.addEventListener("click", onGesture);
      window.addEventListener("touchstart", onGesture);
      window.addEventListener("keydown", onGesture);
      window.addEventListener("scroll", onGesture);
      window.addEventListener("pointerdown", onGesture);
      attached = true;
    };

    (async () => {
      const ok = await tryPlay();
      if (!ok) attachGestureHandlers();
    })();

    return () => {
      removeGestureHandlers();
    };
  }, [activeTrack, userMuted, pausedByEvent, mounted]);

  if (!mounted || !ready || !activeTrack) return null;

  const audioPlaying = audioRef.current ? !audioRef.current.paused : false;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" playsInline />

      <button
        type="button"
        onClick={async () => {
          const audio = audioRef.current;
          if (!audio) return;

          if (audio.paused) {
            audio.muted = false;
            setUserMuted(false);
            try {
              await audio.play();
              setNeedsGesture(false);
            } catch {
              setNeedsGesture(true);
            }
            return;
          }

          const next = !userMuted;
          setUserMuted(next);
          audio.muted = next;
        }}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-xl text-white shadow-lg transition hover:bg-violet-700"
        title={userMuted ? "تشغيل الصوت" : "إسكات الصوت"}
        aria-label={userMuted ? "تشغيل الصوت" : "إسكات الصوت"}
      >
        {userMuted ? "🔇" : "🔊"}
      </button>

      {needsGesture && !audioPlaying && !pausedByEvent ? (
        <div className="fixed bottom-4 left-20 z-50 max-w-[60%] rounded-2xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 shadow-lg">
          👆 انقر في أي مكان لتشغيل الموسيقى
        </div>
      ) : null}
    </>
  );
}