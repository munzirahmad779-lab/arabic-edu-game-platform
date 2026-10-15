"use client";

import { useState } from "react";
import { GameRegistry } from "@/lib/game-engine/registry";

type Track = {
  id: string;
  name: string;
};

type GameModeDict = {
  label: string;
  competitive: string;
  cooperative: string;
  endless: string;
  practice: string;
  duration_label: string;
  duration_hint: string;
  no_timer_note: string;
  self_practice_note: string;
  backsound_label: string;
  backsound_none: string;
  backsound_empty_hint: string;
  backsound_hint: string;
};

type Props = {
  tracks: Track[];
  gm: GameModeDict;
  gt?: Record<string, string>;
};

export const NATIVE_GAME_ENGINES = [
  {
    id: "kahoot",
    name: "Kahoot Arena Showdown",
    icon: "▲",
    badge: "Panggung Proyektor + HP Siswa",
    desc: "4 Kartu warna raksasa (▲, ◆, ●, ■), timer panggung, podium juara, dan terhubung langsung ke HP siswa sebagai stik buzzer nirkabel (/controller).",
    color: "from-rose-600 to-red-700",
    border: "border-rose-400",
  },
  {
    id: "airplane",
    name: "Pesawat Terbang Awan",
    icon: "✈️",
    badge: "Arkade Canvas 60 FPS",
    desc: "Kendalikan pesawat kartun melintasi langit untuk menabrak awan dengan jawaban yang tepat. Efek partikel ledakan emas, baling-baling berputar & kontrol panah/W-S.",
    color: "from-sky-600 to-blue-700",
    border: "border-sky-400",
  },
  {
    id: "whack",
    name: "Pukul Tikus Vocab (Whack-a-Mole)",
    icon: "🔨",
    badge: "Arkade Refleks Palu",
    desc: "Tikus tanah melompat keluar dari 6 liang tanah membawa papan jawaban. Ayunkan palu virtual untuk memukul tikus yang membawa jawaban yang benar secepat mungkin.",
    color: "from-amber-600 to-yellow-700",
    border: "border-amber-400",
  },
  {
    id: "wheel",
    name: "Roda Putar Keberuntungan",
    icon: "🎡",
    badge: "Fisika Roda Karnaval",
    desc: "Roda putar fisika canvas dengan gaya gesek & inersia. Putar roda dengan klik untuk mendaratkan jarum pada pilihan jawaban soal tantangan.",
    color: "from-emerald-600 to-teal-700",
    border: "border-emerald-400",
  },
  {
    id: "memory",
    name: "Kartu Memori Flip 3D",
    icon: "🃏",
    badge: "3D Perspective Flip",
    desc: "Permainan kartu memori 3D berputar (rotateY 180°). Buka pasangan kartu mufrodat bahasa Arab dan terjemahan bahasa Indonesianya.",
    color: "from-purple-600 to-indigo-700",
    border: "border-purple-400",
  },
  {
    id: "balloon",
    name: "Pecahkan Balon Jawaban",
    icon: "🎈",
    badge: "Fisika Balon Melayang",
    desc: "Balon-balon warna-warni melayang ke atas dari dasar layar dengan gerakan terombang-ambing. Klik balon yang membawa jawaban yang tepat untuk meletuskannya.",
    color: "from-pink-600 to-rose-700",
    border: "border-pink-400",
  },
];

export function GameModeSelector({ tracks, gm }: Props) {
  const [selectedEngine, setSelectedEngine] = useState<string>("kahoot");
  const [mode, setMode] = useState("competitive");

  const supportedModes = GameRegistry.get("quiz").capabilities.supportedModes;

  const isTimed =
    mode === "competitive" ||
    mode === "cooperative" ||
    mode === "learning";
  const isSelfPractice = mode === "endless" || mode === "practice";

  const activeEngineInfo =
    NATIVE_GAME_ENGINES.find((g) => g.id === selectedEngine) ?? NATIVE_GAME_ENGINES[0]!;

  return (
    <>
      <div className="lg:col-span-2 space-y-4">
        <div>
          <label className="block text-sm font-bold text-teal-800 mb-1">
            🎮 Pilih Mode & Animasi Game Pembelajaran:
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Setiap game berjalan 100% lokal di browser & proyektor dengan animasi 60 FPS, efek suara, dan pertanyaan yang otomatis disesuaikan dari bank soal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NATIVE_GAME_ENGINES.map((eng) => {
              const isPicked = selectedEngine === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setSelectedEngine(eng.id)}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all ${
                    isPicked
                      ? `bg-gradient-to-br ${eng.color} ${eng.border} text-white shadow-lg scale-[1.02]`
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{eng.icon}</span>
                    <span className="font-black text-xs truncate">{eng.name}</span>
                  </div>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1.5 ${
                      isPicked ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {eng.badge}
                  </span>
                  <p
                    className={`text-[11px] line-clamp-2 leading-relaxed ${
                      isPicked ? "text-white/90" : "text-slate-500"
                    }`}
                  >
                    {eng.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Database compatibility inputs */}
        <input type="hidden" name="game_type" value="quiz" />
        <input type="hidden" name="game_theme" value={selectedEngine} />

        {/* Dynamic Mechanic Info Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
          <span className="text-2xl">{activeEngineInfo.icon}</span>
          <div>
            <span className="font-black block mb-0.5">
              Mekanik & Animasi: {activeEngineInfo.name}
            </span>
            <p className="text-indigo-800 leading-relaxed">{activeEngineInfo.desc}</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <label htmlFor="mode" className="block text-sm font-medium">
          {gm.label}
        </label>
        <select
          id="mode"
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          {supportedModes.includes("competitive") && (
            <option value="competitive">{gm.competitive}</option>
          )}
          {supportedModes.includes("cooperative") && (
            <option value="cooperative">{gm.cooperative}</option>
          )}
          {supportedModes.includes("endless") && (
            <option value="endless">{gm.endless}</option>
          )}
          {supportedModes.includes("practice") && (
            <option value="practice">{gm.practice}</option>
          )}
        </select>
      </div>

      {isTimed ? (
        <div>
          <label
            htmlFor="duration-minutes"
            className="block text-sm font-medium"
          >
            {gm.duration_label}
          </label>
          <input
            id="duration-minutes"
            name="duration_minutes"
            type="number"
            min={1}
            max={60}
            step={1}
            defaultValue={5}
            required
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">{gm.duration_hint}</p>
        </div>
      ) : (
        <>
          <input type="hidden" name="duration_minutes" value="5" />
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            {gm.no_timer_note}
          </div>
        </>
      )}

      {isSelfPractice ? (
        <div className="lg:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          {gm.self_practice_note}
        </div>
      ) : null}

      <div className="lg:col-span-2">
        <label
          htmlFor="backsound-track-id"
          className="block text-sm font-medium"
        >
          {gm.backsound_label}
        </label>
        <select
          id="backsound-track-id"
          name="backsound_track_id"
          defaultValue=""
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">{gm.backsound_none}</option>
          {tracks.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          {tracks.length === 0 ? gm.backsound_empty_hint : gm.backsound_hint}
        </p>
      </div>
    </>
  );
}