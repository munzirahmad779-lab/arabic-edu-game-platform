"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BG_AUDIO_PAUSE_EVENT,
  BG_AUDIO_RESUME_EVENT,
} from "@/lib/bg-audio-events";
import { updateTeacherTheme } from "@/app/dashboard/actions";

type Track = {
  id: string;
  name: string;
  audio_url: string;
  volume: number;
  pages: string[];
};

type PageKey = "dashboard" | "login" | "student" | "game" | "final";

const THEMES: { key: string; label: string; color: string }[] = [
  { key: "violet", label: "بنفسجي", color: "#7c3aed" },
  { key: "rose", label: "وردي", color: "#e11d48" },
  { key: "emerald", label: "زمردي", color: "#059669" },
  { key: "sky", label: "سماوي", color: "#0284c7" },
  { key: "amber", label: "عسلي", color: "#d97706" },
  { key: "indigo", label: "نيلي", color: "#4f46e5" },
  { key: "slate", label: "رمادي", color: "#334155" },
  { key: "teal", label: "أزرق مخضر", color: "#0d9488" },
];

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
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [userMuted, setUserMuted] = useState(false);
  const [pausedByEvent, setPausedByEvent] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>("violet");
  const [themeLoading, setThemeLoading] = useState(false);

  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem("bg-audio-muted");
      if (saved === "true") setUserMuted(true);
    } catch {
      // ignore
    }
  }, []);

  // Fetch tracks
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
      }
    })();
    return () => {
      alive = false;
    };
  }, [mounted]);

  // Fetch theme (hanya di dashboard, hanya kalau drawer dibuka)
  useEffect(() => {
    if (!mounted || !isDashboard || !settingsOpen) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !alive) return;
        const { data } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .maybeSingle();
        if (!alive) return;
        if (data?.theme) setCurrentTheme(data.theme);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [mounted, isDashboard, settingsOpen]);

  // Simpan preferensi mute
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(
        "bg-audio-muted",
        userMuted ? "true" : "false",
      );
    } catch {
      // ignore
    }
  }, [userMuted, mounted]);

  // Listen pause/resume
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

  // Tutup drawer kalau klik di luar
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (drawerRef.current && !drawerRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const pageKey = pageOf(pathname);
  const activeTrack = pageKey
    ? tracks.find((t) => t.pages.includes(pageKey)) ?? null
    : null;

  // Play/pause
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

  async function selectTheme(themeKey: string) {
    if (themeLoading) return;
    setThemeLoading(true);

    // Update UI langsung
    setCurrentTheme(themeKey);
    const root = document.querySelector("[data-theme]");
    if (root) root.setAttribute("data-theme", themeKey);

    // Simpan ke server
    const fd = new FormData();
    fd.set("theme", themeKey);
    try {
      await updateTeacherTheme(fd);
    } catch {
      // ignore
    } finally {
      setThemeLoading(false);
    }
  }

  if (!mounted) return null;

  const audioPlaying = audioRef.current ? !audioRef.current.paused : false;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" playsInline />

      {/* Drawer */}
      {settingsOpen ? (
        <div
          ref={drawerRef}
          className="fixed bottom-20 left-4 z-50 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          dir="rtl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-white">
            <span className="text-sm font-black">⚙️ الإعدادات السريعة</span>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-black transition hover:bg-white/30"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 p-3">
            {/* Mute toggle */}
            <button
              type="button"
              onClick={() => setUserMuted((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 transition hover:bg-neutral-100"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                <span className="text-lg">{userMuted ? "🔇" : "🔊"}</span>
                <span>{userMuted ? "الصوت مكتوم" : "الصوت مفعّل"}</span>
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  userMuted ? "bg-neutral-300" : "bg-emerald-500"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition ${
                    userMuted ? "translate-x-1" : "-translate-x-5"
                  }`}
                />
              </span>
            </button>

            {/* Theme picker (dashboard only) */}
            {isDashboard ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="mb-3 text-xs font-black text-neutral-700">
                  🎨 ثيم لوحة التحكم
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((t) => {
                    const active = currentTheme === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => void selectTheme(t.key)}
                        disabled={themeLoading}
                        title={t.label}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition disabled:opacity-60 ${
                          active
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-transparent hover:border-neutral-200"
                        }`}
                      >
                        <span
                          className="block h-8 w-8 rounded-full shadow-md ring-2 ring-white"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-[10px] font-bold text-neutral-600">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-neutral-400">
                  ملاحظة: الثيم يطبّق على لوحة التحكم فقط، ولا يؤثر على صفحات
                  الطلاب.
                </p>
              </div>
            ) : null}

            {/* Dashboard-only links */}
            {isDashboard ? (
              <>
                <Link
                  href="/dashboard/settings/audio"
                  onClick={() => setSettingsOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-bold text-neutral-800 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  <span className="text-lg">🎵</span>
                  <span>إدارة الموسيقى الخلفية</span>
                </Link>

                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
                  🔜 قريبًا: رابط بوابة الطالب، إدارة الحساب، والسجل
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Floating gear button */}
      <button
        type="button"
        onClick={() => setSettingsOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-xl text-white shadow-lg transition hover:bg-violet-700"
        title="الإعدادات السريعة"
        aria-label="الإعدادات السريعة"
      >
        ⚙️
      </button>

      {/* Hint gesture */}
      {needsGesture && !audioPlaying && !pausedByEvent && activeTrack ? (
        <div className="fixed bottom-4 left-20 z-40 max-w-[60%] rounded-2xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 shadow-lg">
          👆 انقر في أي مكان لتشغيل الموسيقى
        </div>
      ) : null}
    </>
  );
}