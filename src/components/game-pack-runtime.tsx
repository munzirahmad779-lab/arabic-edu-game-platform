"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import {
  GAME_PACK_AVAILABLE,
  GAME_REGISTRY,
} from "@/modules/games-pack/games-registry";

function PackLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
        <p className="mt-5 text-sm font-bold text-white/80">Memuat game…</p>
      </div>
    </main>
  );
}

const GAME_COMPONENTS: Record<string, ComponentType | undefined> =
  Object.fromEntries(
    Object.entries(GAME_REGISTRY).map(([slug, loader]) => [
      slug,
      dynamic(loader, { ssr: false, loading: PackLoading }),
    ]),
  );

function DetachedFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white">
      <section className="w-full max-w-xl rounded-[2rem] border border-cyan-300/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
        <div className="text-5xl" aria-hidden="true">
          🔌
        </div>
        <h1 className="mt-4 text-2xl font-black">Game pack sedang dilepas</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Web utama Magguru tetap aktif dalam mode ringan. Colok kembali game pack
          untuk mengaktifkan seluruh permainan.
        </p>
      </section>
    </main>
  );
}

export function GamePackRuntime({ slug }: { readonly slug: string }) {
  if (!GAME_PACK_AVAILABLE) return <DetachedFallback />;

  const Engine = GAME_COMPONENTS[slug];
  if (!Engine) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <p className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-6 py-4 font-bold">
          Engine game tidak ditemukan.
        </p>
      </main>
    );
  }

  return <Engine />;
}
