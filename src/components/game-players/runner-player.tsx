"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QuestionAdapter } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

export function RunnerPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const runnerQuestion = useMemo(
    () => QuestionAdapter.toRunner(question),
    [question],
  );

  const [activeLane, setActiveLane] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [characterState, setCharacterState] = useState<"running" | "boost" | "stumble">("running");
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  const handleLaneCommit = useCallback(
    async (laneIndex: number) => {
      if (submitting || hasAnswered) return;
      const lane = runnerQuestion.lanes[laneIndex];
      if (!lane) return;

      setSubmitting(true);
      setHasAnswered(true);
      playSfx("click");

      const result = await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: lane.optionId,
        answerText: null,
        responseTimeMs: 1500,
      });

      if (result.isCorrect) {
        setCharacterState("boost");
        playSfx("boost");
        onGameEvent?.({
          isCorrect: true,
          scoreAwarded: result.scoreAwarded ?? 100,
          comboMultiplier: 2,
          streak: 1,
          consequence: "boost",
          message: "SUPER DASH! Kecepatan Maksimal ⚡🚀",
        });
      } else {
        setCharacterState("stumble");
        playSfx("stumble");
        onGameEvent?.({
          isCorrect: false,
          scoreAwarded: 0,
          comboMultiplier: 1,
          streak: 0,
          consequence: "stumble",
          message: "Terpeleset Hambatan! Pelan sejenak ⚠️🏃",
        });
      }

      setSubmitting(false);
    },
    [submitting, hasAnswered, runnerQuestion.lanes, onSubmitAnswer, question.id, onGameEvent],
  );

  // Background track simulation loop
  useEffect(() => {
    const interval = window.setInterval(() => {
      setDistanceMeters((d) => d + (characterState === "boost" ? 12 : characterState === "stumble" ? 1 : 4));
    }, 150);
    return () => window.clearInterval(interval);
  }, [characterState]);

  // Keyboard navigation: ArrowLeft/ArrowRight or numbers 1-4
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (submitting || hasAnswered) return;

      const laneCount = runnerQuestion.lanes.length;
      if (e.key === "ArrowLeft") {
        setActiveLane((prev) => (isRtl ? Math.min(laneCount - 1, prev + 1) : Math.max(0, prev - 1)));
      } else if (e.key === "ArrowRight") {
        setActiveLane((prev) => (isRtl ? Math.max(0, prev - 1) : Math.min(laneCount - 1, prev + 1)));
      } else if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        if (idx < laneCount) {
          setActiveLane(idx);
          void handleLaneCommit(idx);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        void handleLaneCommit(activeLane);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLane, runnerQuestion.lanes.length, isRtl, submitting, hasAnswered, handleLaneCommit]);

  const laneCount = runnerQuestion.lanes.length;

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Race Progress Bar & Distance Counter */}
      <div className="flex items-center justify-between text-xs font-black text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            🏁
          </span>
          <span>Jarak Tempuh: {distanceMeters}m</span>
        </div>
        <div className="text-white/60">
          Gunakan tombol arah / sentuh jalur untuk melaju
        </div>
      </div>

      {/* Question Challenge Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-5 text-center border border-emerald-500/30 shadow-inner">
        <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
          Tantangan Lintasan Soal
        </span>
        <h2 className="mt-2 text-2xl font-black leading-relaxed text-white sm:text-3xl">
          {runnerQuestion.questionText}
        </h2>
      </div>

      {/* 3D-feel Track Visualizer with Lanes */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 p-2 border-2 border-emerald-500/20 shadow-2xl">
        {/* Track Grid Lines */}
        <div className="absolute inset-0 grid h-full w-full" style={{ gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
          {runnerQuestion.lanes.map((_, idx) => (
            <div
              key={idx}
              className={`h-full border-r border-dashed border-emerald-400/20 ${
                activeLane === idx ? "bg-emerald-500/10" : ""
              }`}
            />
          ))}
        </div>

        {/* Speed Lines on Boost */}
        {characterState === "boost" && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-emerald-500/20 via-transparent to-teal-300/10" />
        )}

        {/* Hurdles / Gates approaching */}
        <div className="absolute inset-x-0 top-6 grid gap-2 px-2" style={{ gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
          {runnerQuestion.lanes.map((lane, idx) => (
            <button
              key={lane.optionId}
              type="button"
              disabled={submitting || hasAnswered}
              onClick={() => {
                setActiveLane(idx);
                void handleLaneCommit(idx);
              }}
              className={`group flex flex-col items-center justify-between rounded-xl p-3 text-center transition-all duration-200 border-2 ${
                activeLane === idx
                  ? "border-emerald-400 bg-emerald-500/30 scale-105 shadow-lg shadow-emerald-500/30"
                  : "border-slate-700 bg-slate-900/80 hover:border-emerald-400/60"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white shadow">
                {lane.optionKey}
              </span>
              <span className="mt-2 line-clamp-3 text-sm font-bold text-white group-hover:text-emerald-200">
                {lane.text}
              </span>
              <span className="mt-2 text-[10px] uppercase font-black tracking-wider text-emerald-400/80">
                Gerbang #{idx + 1}
              </span>
            </button>
          ))}
        </div>

        {/* Runner Character Avatar */}
        <div
          className={`absolute bottom-4 flex items-center justify-center transition-all duration-200`}
          style={{
            width: `${100 / laneCount}%`,
            left: `${(activeLane / laneCount) * 100}%`,
          }}
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-xl transition-transform ${
              characterState === "boost"
                ? "bg-gradient-to-tr from-amber-400 to-emerald-400 scale-125 shadow-emerald-400/50"
                : characterState === "stumble"
                ? "bg-rose-600 scale-90 rotate-12 shadow-rose-600/50"
                : "bg-emerald-600 hover:scale-105"
            }`}
          >
            {characterState === "boost" ? "🚀" : characterState === "stumble" ? "💥" : "🏃‍♂️"}
          </div>
        </div>
      </div>

      {/* Mobile-Friendly Quick Lane Selector Buttons */}
      <div className="grid gap-2 pt-2" style={{ gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
        {runnerQuestion.lanes.map((lane, idx) => (
          <button
            key={lane.optionId}
            type="button"
            disabled={submitting || hasAnswered}
            onClick={() => {
              setActiveLane(idx);
              void handleLaneCommit(idx);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl py-3 px-2 font-black transition active:scale-95 border-2 ${
              activeLane === idx
                ? "border-emerald-400 bg-emerald-600 text-white shadow-lg"
                : "border-slate-700 bg-slate-800 text-white/90 hover:bg-slate-700"
            }`}
          >
            <span className="text-xs uppercase opacity-75">Jalur {idx + 1}</span>
            <span className="text-base truncate max-w-full font-black">
              {lane.optionKey}: {lane.text}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
