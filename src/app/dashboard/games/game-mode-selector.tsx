"use client";

import { useState } from "react";

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
};

export function GameModeSelector({ tracks, gm }: Props) {
  const [mode, setMode] = useState("competitive");
  const isTimed =
    mode === "competitive" ||
    mode === "cooperative" ||
    mode === "learning" ||
    mode === "anagram";
  const isSelfPractice = mode === "endless" || mode === "practice";

  return (
    <>
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
          <option value="competitive">{gm.competitive}</option>
          <option value="cooperative">{gm.cooperative}</option>
          <option value="anagram">
            ✨ Susun Huruf (Anagram) — main di game room
          </option>
          <option value="endless">{gm.endless}</option>
          <option value="practice">{gm.practice}</option>
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