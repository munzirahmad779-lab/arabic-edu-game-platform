"use client";

import { useEffect, useState, useCallback } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion, RawOption } from "@/lib/game-engine/types";

const HOLES = [0, 1, 2, 3, 4, 5];

export function WhackPlayer({
  questions,
  onFinish,
  isRtl = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number) => void;
  isRtl?: boolean;
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timerLeft, setTimerLeft] = useState(30);
  const [isGameOver, setIsGameOver] = useState(false);
  const [activeHoles, setActiveHoles] = useState<
    Array<{
      holeId: number;
      option: RawOption;
      isPopped: boolean;
      hit: boolean;
    }>
  >([]);

  // Hammer swing animation coordinates
  const [hammerPos, setHammerPos] = useState<{ x: number; y: number; active: boolean } | null>(null);

  const activeQuestion = questions[currentQIndex % (questions.length || 1)] || {
    id: "q-mock",
    position: 0,
    question_text: "Pukul Tikus Kosakata",
    options: [
      { id: "1", option_key: "A", option_text: "Jawaban A" },
      { id: "2", option_key: "B", option_text: "Jawaban B" },
      { id: "3", option_key: "C", option_text: "Jawaban C" },
      { id: "4", option_key: "D", option_text: "Jawaban D" },
    ],
    correct_option_key: "A",
  };

  const correctKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Randomly assign options to holes
  const shuffleMoles = useCallback(() => {
    const opts = [...activeQuestion.options].slice(0, 4);
    const shuffledHoles = [...HOLES].sort(() => Math.random() - 0.5);

    const newActiveHoles = opts.map((opt, i) => ({
      holeId: shuffledHoles[i]!,
      option: opt,
      isPopped: true,
      hit: false,
    }));

    setActiveHoles(newActiveHoles);
  }, [activeQuestion.options]);

  useEffect(() => {
    shuffleMoles();
    const interval = setInterval(() => {
      shuffleMoles();
    }, 2800);
    return () => clearInterval(interval);
  }, [shuffleMoles]);

  // Countdown timer
  useEffect(() => {
    if (isGameOver) return;
    const timer = setInterval(() => {
      setTimerLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setIsGameOver(true);
          onFinish?.(score);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGameOver, score, onFinish]);

  // Handle Bonk
  const handleWhack = (opt: RawOption, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHammerPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
      active: true,
    });
    setTimeout(() => setHammerPos(null), 300);

    const isCorrect = opt.option_key.toUpperCase().trim() === correctKey;

    if (isCorrect) {
      playSfx("correct");
      setScore((s) => s + 100 + streak * 25);
      setStreak((st) => st + 1);

      // Advance question
      setTimeout(() => {
        if (currentQIndex + 1 < questions.length) {
          setCurrentQIndex((idx) => idx + 1);
        } else {
          setIsGameOver(true);
        }
      }, 500);
    } else {
      playSfx("wrong");
      setStreak(0);
      setScore((s) => Math.max(0, s - 30));
    }
  };

  return (
    <div className="relative w-full h-[580px] bg-gradient-to-b from-amber-900 to-amber-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-amber-600 select-none p-4">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/50 border border-white/20 p-3.5 rounded-2xl text-white backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔨</span>
          <div>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              WHACK-A-MOLE VOCAB (SOAL #{currentQIndex + 1})
            </span>
            <h3 className="text-base sm:text-lg font-black text-white" dir={isRtl ? "rtl" : "ltr"}>
              {activeQuestion.question_text}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-400/40">
            ⏱️ {timerLeft}s
          </div>
          <div className="px-3 py-1 rounded-xl bg-black/40 font-mono font-black text-emerald-400 text-sm border border-white/10">
            {score} Pts
          </div>
        </div>
      </div>

      {/* 6 Arcade Holes Grid */}
      <div className="grid grid-cols-3 gap-4 sm:gap-6 my-auto max-w-2xl mx-auto w-full z-10 py-4">
        {HOLES.map((hId) => {
          const mole = activeHoles.find((h) => h.holeId === hId);

          return (
            <div key={hId} className="relative flex flex-col items-center justify-end h-32 sm:h-36">
              {/* Mole Hole Dirt Mound */}
              <div className="absolute bottom-0 w-28 sm:w-36 h-10 bg-amber-950 border-4 border-amber-800 rounded-full shadow-inner flex items-center justify-center">
                <div className="w-20 sm:w-28 h-6 bg-black/80 rounded-full" />
              </div>

              {/* Animated Mole popping up */}
              {mole && (
                <button
                  type="button"
                  onClick={(e) => handleWhack(mole.option, e)}
                  className="relative z-10 mb-2 transform transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center animate-in slide-in-from-bottom-8 cursor-pointer"
                >
                  {/* Mole Head & Face */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-700 border-2 border-amber-900 rounded-t-full relative shadow-md flex flex-col items-center pt-2">
                    {/* Ears */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-800 rounded-full" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-800 rounded-full" />
                    {/* Eyes */}
                    <div className="flex gap-2 mb-1">
                      <div className="w-2.5 h-2.5 bg-black rounded-full" />
                      <div className="w-2.5 h-2.5 bg-black rounded-full" />
                    </div>
                    {/* Snout */}
                    <div className="w-4 h-2.5 bg-rose-400 rounded-full mb-1" />
                  </div>

                  {/* Choice Board held by Mole */}
                  <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-amber-900 shadow-xl text-center max-w-[140px] -mt-1 z-20">
                    <span className="font-mono font-black text-xs text-amber-700 mr-1">
                      {mole.option.option_key}:
                    </span>
                    <span
                      className="font-black text-sm text-slate-900 truncate inline-block max-w-[95px] leading-tight"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {mole.option.option_text}
                    </span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Mallet Swing Effect */}
      {hammerPos && (
        <div
          className="fixed pointer-events-none z-50 text-5xl transform -rotate-45 animate-spin"
          style={{ left: hammerPos.x - 30, top: hammerPos.y - 40 }}
        >
          🔨
        </div>
      )}

      {/* Bottom Hint */}
      <div className="text-center text-xs text-amber-200/80 bg-black/30 py-1.5 rounded-xl">
        Pukul tikus yang membawa jawaban yang benar secepat mungkin!
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🏆</span>
          <h2 className="text-3xl font-black">Waktu Habis!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={() => {
              setCurrentQIndex(0);
              setScore(0);
              setTimerLeft(30);
              setStreak(0);
              setIsGameOver(false);
            }}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105"
          >
            🔄 Main Lagi
          </button>
        </div>
      )}
    </div>
  );
}
