"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  embedUrlRejectMessage,
  validateEmbedUrl,
} from "@/lib/game-engine/embed-url";

// Batas waktu tunggu muat iframe. Iframe yang diblokir penyedia
// (X-Frame-Options / CSP) sering tidak memicu onError sama sekali,
// jadi tanpa batas waktu ini guru hanya menatap bingkai kosong.
const LOAD_TIMEOUT_MS = 10_000;

type LoadState = "loading" | "loaded" | "failed" | "timeout";

export function WebGameEmbedPlayer({
  embedUrl,
  title = "Web Game Pembelajaran",
}: {
  embedUrl: string;
  title?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [iframeKey, setIframeKey] = useState(0);

  // Label fullscreen mengikuti keadaan dokumen yang sebenarnya:
  // menekan Esc keluar dari fullscreen tanpa melewati tombol ini,
  // dan label lama (state lokal) menjadi bohong sesudahnya.
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }

  // Format embed URL if plain URL was provided (e.g. wordwall.net/resource/xyz -> wordwall.net/embed/xyz)
  let formattedUrl = embedUrl.trim();
  if (formattedUrl.includes("wordwall.net/resource/")) {
    formattedUrl = formattedUrl.replace("wordwall.net/resource/", "wordwall.net/embed/");
  }

  const validation = validateEmbedUrl(formattedUrl);
  const validUrl = validation.ok ? validation.url : null;

  // Timer batas waktu muat untuk setiap percobaan (termasuk Coba Lagi).
  useEffect(() => {
    if (!validUrl) return;
    setLoadState("loading");
    const timer = window.setTimeout(() => {
      setLoadState((prev) => (prev === "loading" ? "timeout" : prev));
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [validUrl, iframeKey]);

  function handleRetry() {
    setLoadState("loading");
    setIframeKey((k) => k + 1);
  }

  const header = (
    <header className="z-20 flex items-center justify-between bg-slate-900/90 border-b border-white/10 px-4 py-2.5 text-white">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/games"
          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition"
        >
          ← Daftar Game
        </Link>
        <span className="text-xl">🌐</span>
        <span className="font-bold text-sm text-emerald-400">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition"
        >
          {isFullscreen ? "🗗 Keluar Fullscreen" : "⛶ Fullscreen PC / Projector"}
        </button>
      </div>
    </header>
  );

  if (!validUrl) {
    const reason = validation.ok ? "malformed" : validation.reason;
    return (
      <div className="relative w-full h-screen bg-black flex flex-col justify-between overflow-hidden">
        {header}
        <main className="relative flex-1 w-full h-full bg-slate-950">
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center space-y-3">
            <span className="text-5xl">⚠️</span>
            <p className="text-sm font-bold text-white">
              {reason === "empty"
                ? "URL Embed Web Game Belum Dimasukkan"
                : "URL Embed Web Game Tidak Sah"}
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              {reason === "empty"
                ? "Tempelkan URL embed dari Wordwall, Quizizz, Educaplay, atau H5P pada form pembuatan atau pengubahan game."
                : embedUrlRejectMessage(reason)}
            </p>
            <Link
              href="/dashboard/games"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition"
            >
              ← Kembali ke Daftar Game
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black flex flex-col justify-between overflow-hidden">
      {header}

      {/* Main Full-Viewport Web Game Iframe Embed */}
      <main className="relative flex-1 w-full h-full bg-slate-950">
        {loadState !== "failed" ? (
          <iframe
            key={iframeKey}
            src={validUrl}
            title={title}
            className="w-full h-full border-0"
            allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoadState("loaded")}
            onError={() => setLoadState("failed")}
          />
        ) : null}

        {loadState === "loading" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/85 text-center">
            <span className="text-4xl animate-pulse">🌐</span>
            <p className="text-sm font-bold text-white">Memuat web game...</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Bila halaman tidak tampil juga, situs penyedia mungkin menolak
              disematkan di layar lain.
            </p>
          </div>
        ) : null}

        {loadState === "timeout" ? (
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 border-t border-amber-400/40 bg-slate-950/95 p-4 text-center">
            <p className="text-sm font-bold text-amber-300">
              Web game belum selesai dimuat. Situs penyedia mungkin menolak
              disematkan (embed) di layar proyektor.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition"
              >
                🔄 Coba Lagi
              </button>
              <a
                href={validUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                ↗ Buka di Tab Baru
              </a>
              <button
                type="button"
                onClick={() => setLoadState("loaded")}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                Tetap Tampilkan
              </button>
            </div>
          </div>
        ) : null}

        {loadState === "failed" ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center space-y-3">
            <span className="text-5xl">🚫</span>
            <p className="text-sm font-bold text-white">Web Game Gagal Dimuat</p>
            <p className="text-xs text-slate-400 max-w-md">
              Situs penyedia menolak atau gagal menampilkan halaman ini di
              dalam layar proyektor. Coba muat ulang, atau buka web game di
              tab baru lalu tampilkan tab itu ke kelas.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition"
              >
                🔄 Coba Lagi
              </button>
              <a
                href={validUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                ↗ Buka di Tab Baru
              </a>
              <Link
                href="/dashboard/games"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                ← Daftar Game
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
