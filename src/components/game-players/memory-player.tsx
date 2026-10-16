"use client";

import { useState, useMemo } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion } from "@/lib/game-engine/types";

export function MemoryPlayer({
  questions,
  onFinish,
  isRtl = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number) => void;
  isRtl?: boolean;
}) {
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  // Derive card pairs from questions (e.g. question text and correct answer)
  const cards = useMemo(() => {
    const list: Array<{ id: number; pairId: number; text: string; isPrompt: boolean }> = [];
    questions.slice(0, 6).forEach((q, idx) => {
      const correctOpt = q.options.find((o) => o.option_key === q.correct_option_key) || q.options[0];
      // Card 1: Question Text
      list.push({ id: idx * 2, pairId: idx, text: q.question_text, isPrompt: true });
      // Card 2: Answer Text
      list.push({ id: idx * 2 + 1, pairId: idx, text: correctOpt?.option_text || "Jawaban", isPrompt: false });
    });
    // Shuffle cards
    return list.sort(() => Math.random() - 0.5);
  }, [questions]);

  const handleCardClick = (index: number) => {
    if (flippedIndices.length >= 2) return;
    if (flippedIndices.includes(index)) return;
    if (matchedIds.includes(cards[index]?.pairId ?? -1)) return;

    playSfx("click");
    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const cardA = cards[nextFlipped[0]!];
      const cardB = cards[nextFlipped[1]!];

      if (cardA && cardB && cardA.pairId === cardB.pairId) {
        // MATCH!
        playSfx("correct");
        setScore((s) => s + 100);
        setMatchedIds((prev) => {
          const next = [...prev, cardA.pairId];
          if (next.length * 2 >= cards.length) {
            setIsGameOver(true);
            onFinish?.(score + 100);
          }
          return next;
        });
        setFlippedIndices([]);
      } else {
        // MISMATCH!
        playSfx("wrong");
        setTimeout(() => {
          setFlippedIndices([]);
        }, 900);
      }
    }
  };

  return (
    <div
      className="relative w-full h-[580px] bg-gradient-to-b from-purple-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-purple-500 select-none p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/60 border border-white/20 p-3.5 rounded-2xl text-white backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🃏</span>
          <div>
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
              KARTU MEMORI FLIP 3D
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Cocokkan Soal dengan Jawabannya!
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-mono font-black text-sm border border-purple-400/40">
            Langkah: {moves}
          </div>
          <div className="px-3 py-1 rounded-xl bg-black/40 font-mono font-black text-emerald-400 text-sm border border-white/10">
            {score} Pts
          </div>
        </div>
      </div>

      {/* 3D Flip Card Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 my-auto max-w-2xl mx-auto w-full z-10 py-3 perspective-[1000px]">
        {cards.map((card, idx) => {
          const isFlipped = flippedIndices.includes(idx) || matchedIds.includes(card.pairId);
          const isMatched = matchedIds.includes(card.pairId);
          const textLen = card.text.length;
          const fontSizeClass =
            textLen > 24
              ? "text-[11px] sm:text-xs leading-tight"
              : textLen > 14
              ? "text-xs sm:text-[13px] leading-snug"
              : "text-sm sm:text-base leading-snug";

          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(idx)}
              className="h-28 sm:h-32 cursor-pointer transform transition-transform duration-500 relative memory-card"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Card Back (Hidden state) */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-indigo-700 to-purple-800 border-2 border-purple-400/60 rounded-2xl flex items-center justify-center shadow-lg hover:border-purple-300 transition"
                style={{ backfaceVisibility: "hidden" }}
              >
                <span className="text-3xl">❓</span>
              </div>

              {/* Card Front (Revealed state) */}
              <div
                className={`absolute inset-0 rounded-2xl border-2 p-2 flex flex-col items-center justify-between text-center shadow-xl overflow-hidden ${
                  isMatched
                    ? "bg-emerald-600 border-emerald-300 text-white"
                    : card.isPrompt
                    ? "bg-slate-900 border-sky-400 text-sky-200"
                    : "bg-amber-900 border-amber-400 text-amber-200"
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <span className="text-[9px] font-mono tracking-widest font-black opacity-80 uppercase px-2 py-0.5 rounded-full bg-black/30 shrink-0">
                  {card.isPrompt ? "SOAL" : "JAWABAN"}
                </span>
                <div className="flex-1 flex items-center justify-center w-full px-1 py-0.5 overflow-hidden">
                  <span
                    className={`font-black text-center break-words max-h-[64px] sm:max-h-[72px] overflow-hidden ${fontSizeClass}`}
                    style={{
                      fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif",
                      lineHeight: 1.3,
                    }}
                    dir="auto"
                  >
                    {card.text}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-purple-300/80 bg-black/40 py-2 rounded-xl">
        Buka 2 kartu yang cocok untuk mencocokkan soal dan jawaban mufrodat!
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🎉</span>
          <h2 className="text-3xl font-black">Semua Pasangan Terbuka!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor: {score} Poin ({moves} Langkah)</p>
          <button
            type="button"
            onClick={() => {
              setFlippedIndices([]);
              setMatchedIds([]);
              setMoves(0);
              setScore(0);
              setIsGameOver(false);
            }}
            className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-xl transition hover:scale-105"
          >
            🔄 Acak Ulang Kartu
          </button>
        </div>
      )}
    </div>
  );
}
