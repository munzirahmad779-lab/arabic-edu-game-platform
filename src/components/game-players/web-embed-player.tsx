"use client";

import { useState } from "react";

export function WebGameEmbedPlayer({
  embedUrl,
  title = "Web Game Pembelajaran",
}: {
  embedUrl: string;
  title?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  // Format embed URL if plain URL was provided (e.g. wordwall.net/resource/xyz -> wordwall.net/embed/xyz)
  let formattedUrl = embedUrl.trim();
  if (formattedUrl.includes("wordwall.net/resource/")) {
    formattedUrl = formattedUrl.replace("wordwall.net/resource/", "wordwall.net/embed/");
  }

  return (
    <div className="relative w-full h-screen bg-black flex flex-col justify-between overflow-hidden">
      {/* HUD Header Bar */}
      <header className="z-20 flex items-center justify-between bg-slate-900/90 border-b border-white/10 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
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

      {/* Main Full-Viewport Web Game Iframe Embed */}
      <main className="relative flex-1 w-full h-full bg-slate-950">
        {formattedUrl ? (
          <iframe
            src={formattedUrl}
            title={title}
            className="w-full h-full border-0"
            allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center space-y-3">
            <span className="text-5xl">⚠️</span>
            <p className="text-sm font-bold text-white">URL Embed Web Game Belum Dimasukkan</p>
            <p className="text-xs text-slate-400 max-w-md">
              Tempelkan URL embed dari Wordwall, Quizizz, Educaplay, atau H5P pada form pembuatan game.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
