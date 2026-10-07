"use client";

import { useState } from "react";
import { GameRegistry } from "@/lib/game-engine/registry";
import type { NormalizedGameType } from "@/lib/game-engine/types";

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

type GameTypeDict = {
  label: string;
  hint: string;
  runner: string;
  matching: string;
  penalty: string;
  anagram: string;
  quiz: string;
};

type Props = {
  tracks: Track[];
  gm: GameModeDict;
  gt?: GameTypeDict;
};

export function GameModeSelector({ tracks, gm, gt }: Props) {
  const [gameType, setGameType] = useState<NormalizedGameType>("runner");
  const [mode, setMode] = useState("competitive");

  const supportedModes = GameRegistry.get(gameType).capabilities.supportedModes;

  function handleGameTypeChange(newType: NormalizedGameType) {
    setGameType(newType);
    const newSupported = GameRegistry.get(newType).capabilities.supportedModes;
    if (!newSupported.includes(mode as never)) {
      setMode(newSupported[0] || "competitive");
    }
  }

  const isTimed =
    mode === "competitive" ||
    mode === "cooperative" ||
    mode === "learning" ||
    mode === "anagram";
  const isSelfPractice = mode === "endless" || mode === "practice";

  return (
    <>
      <div className="lg:col-span-2">
        <label htmlFor="game_type" className="block text-sm font-medium">
          {gt?.label ?? "Tipe Permainan (Mekanik)"}
        </label>
        <select
          id="game_type"
          name="game_type"
          value={gameType}
          onChange={(e) => handleGameTypeChange(e.target.value as NormalizedGameType)}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-800"
        >
          <option value="runner">
            {gt?.runner ?? "🏃‍♂️ Magguru Runner — Balapan cepat multi-jalur"}
          </option>
          <option value="matching">
            {gt?.matching ?? "🧩 Magguru Matching — Cocokkan pasangan kata"}
          </option>
          <option value="penalty">
            {gt?.penalty ?? "⚽ Magguru Penalty — Tendangan penalti ke gawang"}
          </option>
          <option value="anagram">
            {gt?.anagram ?? "🔤 Susun Huruf (Anagram) — Susun huruf acak"}
          </option>
          <option value="quiz">
            {gt?.quiz ?? "📝 Kuis Klasik — Pilihan ganda"}
          </option>
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          {gt?.hint ?? "Pilih mekanik permainan yang akan dimainkan siswa."}
        </p>
        {gameType === "matching" && (
          <p className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-xs text-indigo-900 font-medium">
            💡 <strong>Tips Soal Matching:</strong> Buat pilihan jawaban dengan format pasangan kata (contoh: <code>كِتَابٌ : Buku</code>) agar sistem dapat membentuk kartu pasangan secara otomatis.
          </p>
        )}
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