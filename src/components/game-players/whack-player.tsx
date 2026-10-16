"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  const [questionList, setQuestionList] = useState(() => [...questions]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [health, setHealth] = useState(3);
  const [timerLeft, setTimerLeft] = useState(25);
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

  const activeQuestion = useMemo(() => {
    return (
      questionList[currentQIndex % (questionList.length || 1)] || {
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
      }
    );
  }, [questionList, currentQIndex]);

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

  // Countdown timer per question
  useEffect(() => {
    if (isGameOver) return;
    const timer = setInterval(() => {
      setTimerLeft((t) => {
        if (t <= 1) {
          // Timeout penalty: lose 1 heart instead of instant game over
          playSfx("wrong");
          setStreak(0);
          setHealth((h) => {
            if (h <= 1) {
              clearInterval(timer);
              setIsGameOver(true);
              onFinish?.(score);
              return 0;
            }
            return h - 1;
          });
          // Advance to next question on timeout
          if (currentQIndex + 1 < questionList.length) {
            setCurrentQIndex((idx) => idx + 1);
            return 25;
          } else {
            setIsGameOver(true);
            return 0;
          }
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGameOver, score, onFinish, currentQIndex, questionList.length]);

  // Handle Bonk
  const handleWhack = (opt: RawOption, e: React.MouseEvent) => {
    if (isGameOver) return;

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
      setTimerLeft((t) => Math.min(30, t + 5)); // Bonus +5s

      // Advance question
      setTimeout(() => {
        if (currentQIndex + 1 < questionList.length) {
          setCurrentQIndex((idx) => idx + 1);
          setTimerLeft(25);
        } else {
          setIsGameOver(true);
          onFinish?.(score + 100);
        }
      }, 500);
    } else {
      playSfx("wrong");
      setStreak(0);
      setScore((s) => Math.max(0, s - 30));
      // Deduct 1 health heart - only game over when all 3 hearts are depleted!
      setHealth((h) => {
        if (h <= 1) {
          setIsGameOver(true);
          onFinish?.(score);
          return 0;
        }
        return h - 1;
      });
    }
  };

  const handleRestartAndReshuffle = () => {
    setQuestionList([...questions].sort(() => Math.random() - 0.5));
    setCurrentQIndex(0);
    setScore(0);
    setHealth(3);
    setTimerLeft(25);
    setStreak(0);
    setIsGameOver(false);
  };

  return (
    <div
      className="relative w-full h-[600px] bg-gradient-to-b from-amber-900 via-amber-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-amber-600 select-none p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/60 border border-white/20 p-3.5 rounded-2xl text-white backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔨</span>
          <div>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              WHACK-A-MOLE VOCAB (SOAL #{currentQIndex + 1} / {questionList.length})
            </span>
            <h3
              className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-[1.6]"
              style={{ fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif" }}
              dir="auto"
            >
              {activeQuestion.question_text}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Health Hearts */}
          <div className="flex items-center gap-1 text-sm bg-black/40 px-3 py-1 rounded-xl border border-white/10">
            {[1, 2, 3].map((h) => (
              <span key={h} className={h <= health ? "text-rose-500 text-lg" : "text-slate-600 text-lg"}>
                ♥
              </span>
            ))}
          </div>

          <div className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-400/40">
            ⏱️ {timerLeft}s
          </div>
          <div className="px-3 py-1 rounded-xl bg-black/40 font-mono font-black text-emerald-400 text-sm border border-white/10">
            {score} Pts
          </div>
        </div>
      </div>

      {/* 6 Arcade Holes Grid */}
      <div className="grid grid-cols-3 gap-4 sm:gap-6 my-auto max-w-3xl mx-auto w-full z-10 py-4">
        {HOLES.map((hId) => {
          const mole = activeHoles.find((h) => h.holeId === hId);

          return (
            <div key={hId} className="relative flex flex-col items-center justify-end h-36 sm:h-40">
              {/* Mole Hole Dirt Mound */}
              <div className="absolute bottom-0 w-32 sm:w-44 h-12 bg-amber-950 border-4 border-amber-800 rounded-full shadow-inner flex items-center justify-center">
                <div className="w-24 sm:w-36 h-7 bg-black/80 rounded-full" />
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

                  {/* Choice Board held by Mole - Adaptive Width and No Truncation */}
                  <div className="px-3.5 py-2 rounded-2xl bg-white border-2 border-amber-900 shadow-xl text-center min-w-[130px] max-w-[240px] -mt-1 z-20 choice-board flex items-center justify-center gap-1.5">
                    <span className="font-mono font-black text-xs text-amber-700 shrink-0">
                      {mole.option.option_key}:
                    </span>
                    <span
                      className={`font-black text-slate-900 break-words leading-tight ${
                        mole.option.option_text.length > 20
                          ? "text-xs"
                          : mole.option.option_text.length > 12
                          ? "text-xs sm:text-sm"
                          : "text-sm sm:text-base"
                      }`}
                      style={{
                        fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif",
                        lineHeight: 1.25,
                      }}
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
      <div className="text-center text-xs text-amber-200/80 bg-black/40 py-2 rounded-xl">
        Pukul tikus yang membawa jawaban yang benar secepat mungkin! Anda memiliki 3 nyawa.
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🏆</span>
          <h2 className="text-3xl font-black">Permainan Selesai!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={handleRestartAndReshuffle}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105 flex items-center gap-2"
          >
            <span>🎲</span>
            <span>Acak Soal & Main Lagi</span>
          </button>
        </div>
      )}
    </div>
  );
}
