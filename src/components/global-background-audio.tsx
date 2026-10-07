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

type Locale = "id" | "en" | "ar";

const SUPER_ADMIN_EMAIL = "munzirahmad779@gmail.com";

// Label tema diambil dari dictionary (widget.theme_*).
// THEMES hanya menyimpan key & warna.
const THEMES: { key: string; color: string }[] = [
  { key: "violet", color: "#7c3aed" },
  { key: "rose", color: "#e11d48" },
  { key: "emerald", color: "#059669" },
  { key: "sky", color: "#0284c7" },
  { key: "amber", color: "#d97706" },
  { key: "indigo", color: "#4f46e5" },
  { key: "slate", color: "#334155" },
  { key: "teal", color: "#0d9488" },
];

const DICT_LOADERS: Record<Locale, () => Promise<unknown>> = {
  id: () => import("@/lib/i18n/id.json").then((m) => m.default),
  en: () => import("@/lib/i18n/en.json").then((m) => m.default),
  ar: () => import("@/lib/i18n/ar.json").then((m) => m.default),
};

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return "id";
  const m = document.cookie.match(/(?:^|;\s*)app_locale=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : "id";
  return v === "en" || v === "ar" ? v : "id";
}

type WidgetDict = {
  settings_title: string;
  settings_aria: string;
  close: string;
  mute_on: string;
  mute_off: string;
  theme_title: string;
  theme_violet: string;
  theme_rose: string;
  theme_emerald: string;
  theme_sky: string;
  theme_amber: string;
  theme_indigo: string;
  theme_slate: string;
  theme_teal: string;
  link_music: string;
  link_students: string;
  link_reports: string;
  link_account: string;
  link_admin: string;
  copy_portal: string;
  copied: string;
  gesture_hint: string;
};

function themeLabel(w: WidgetDict, key: string): string {
  const map: Record<string, string> = {
    violet: w.theme_violet,
    rose: w.theme_rose,
    emerald: w.theme_emerald,
    sky: w.theme_sky,
    amber: w.theme_amber,
    indigo: w.theme_indigo,
    slate: w.theme_slate,
    teal: w.theme_teal,
  };
  return map[key] ?? key;
}

function pageOf(pathname: string): PageKey | null {
  if (pathname.startsWith("/dashboard/question-banks")) return null;
  if (pathname.startsWith("/student/materials/")) return null;
  if (pathname.startsWith("/dashboard/classes/")) return null;

  if (pathname === "/") return "login";
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
  const [portalCopied, setPortalCopied] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("id");
  const [w, setW] = useState<WidgetDict | null>(null);

  const isDashboard = pathname.startsWith("/dashboard");
  const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL;
  const isRtl = locale === "ar";

  useEffect(() => {
    setMounted(true);
    setLocale(readLocaleCookie());
    try {
      const saved = window.localStorage.getItem("bg-audio-muted");
      if (saved === "true") setUserMuted(true);
    } catch {
      // ignore
    }
  }, []);

  // Load dictionary widget section
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = (await DICT_LOADERS[locale]()) as {
          widget?: WidgetDict;
        };
        if (alive && mod?.widget) setW(mod.widget);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [locale]);

  // Fetch tracks
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.rpc("get_active_audio_tracks");
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

  // Fetch user email
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!alive) return;
        setUserEmail(user?.email ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [mounted]);

  // Fetch theme saat drawer dibuka
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

    setCurrentTheme(themeKey);
    const root = document.querySelector("[data-theme]");
    if (root) root.setAttribute("data-theme", themeKey);

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

  async function copyPortalLink() {
    try {
      const url = `${window.location.origin}/student/login`;
      await navigator.clipboard.writeText(url);
      setPortalCopied(true);
      window.setTimeout(() => setPortalCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (!mounted) return null;

  const audioPlaying = audioRef.current ? !audioRef.current.paused : false;

  // Jangan render drawer sebelum dictionary siap
  const dictReady = w !== null;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" playsInline />

      {/* Floating Settings Drawer */}
      {settingsOpen && dictReady ? (
        <div
          ref={drawerRef}
          className="fixed bottom-20 right-4 sm:right-6 z-50 max-h-[75vh] w-[calc(100vw-2rem)] sm:w-80 overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-white">
            <span className="text-sm font-black">{w.settings_title}</span>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-black transition hover:bg-white/30"
              aria-label={w.close}
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
                <span>{userMuted ? w.mute_off : w.mute_on}</span>
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

            {/* Theme picker */}
            {isDashboard ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="mb-3 text-xs font-black text-neutral-700">
                  {w.theme_title}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((t) => {
                    const active = currentTheme === t.key;
                    const label = themeLabel(w, t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => void selectTheme(t.key)}
                        disabled={themeLoading}
                        title={label}
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
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Dashboard shortcuts */}
            {isDashboard ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/dashboard/settings/audio"
                    onClick={() => setSettingsOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-3 text-xs font-bold text-neutral-800 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span className="text-lg">🎵</span>
                    <span>{w.link_music}</span>
                  </Link>
                  <Link
                    href="/dashboard/students"
                    onClick={() => setSettingsOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-3 text-xs font-bold text-neutral-800 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span className="text-lg">👥</span>
                    <span>{w.link_students}</span>
                  </Link>
                  <Link
                    href="/dashboard/reports"
                    onClick={() => setSettingsOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-3 text-xs font-bold text-neutral-800 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span className="text-lg">📄</span>
                    <span>{w.link_reports}</span>
                  </Link>
                  <Link
                    href="/dashboard/account"
                    onClick={() => setSettingsOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-3 text-xs font-bold text-neutral-800 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span className="text-lg">⚙️</span>
                    <span>{w.link_account}</span>
                  </Link>
                </div>

                {isSuperAdmin ? (
                  <Link
                    href="/dashboard/admin"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-3 text-sm font-black text-slate-800 transition hover:border-slate-500 hover:bg-slate-200"
                  >
                    <span className="text-lg">🛡️</span>
                    <span>{w.link_admin}</span>
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => void copyPortalLink()}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    <span>{w.copy_portal}</span>
                  </span>
                  <span className="text-xs">{portalCopied ? "✓" : "📋"}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Hide floating trigger during active gameplay room where GameHud has its own audio button */}
      {!pathname.startsWith("/join/room") && (
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="fixed bottom-4 right-4 sm:right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-violet-600/90 text-lg text-white shadow-lg backdrop-blur transition hover:bg-violet-700 active:scale-95"
          title={w?.settings_aria ?? "Settings"}
          aria-label={w?.settings_aria ?? "Settings"}
        >
          ⚙️
        </button>
      )}

      {needsGesture && !audioPlaying && !pausedByEvent && activeTrack && w && !pathname.startsWith("/join/room") ? (
        <div className="fixed bottom-4 right-16 z-40 max-w-[65%] rounded-2xl bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-md">
          {w.gesture_hint}
        </div>
      ) : null}
    </>
  );
}