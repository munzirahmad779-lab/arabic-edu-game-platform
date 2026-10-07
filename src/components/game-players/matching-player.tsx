"use client";

import { useMemo, useState } from "react";
import { QuestionAdapter, type MatchingCard } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

export function MatchingPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const matchingQuestion = useMemo(
    () => QuestionAdapter.toMatching(question),
    [question],
  );

  const [selectedCards, setSelectedCards] = useState<MatchingCard[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [movesCount, setMovesCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);

  async function handleCardClick(card: MatchingCard) {
    if (submitting || hasFinished || matchedPairIds.has(card.pairId)) return;
    if (selectedCards.some((c) => c.id === card.id)) return;

    playSfx("click");

    if (selectedCards.length === 0) {
      setSelectedCards([card]);
      return;
    }

    // Second card selected
    const firstCard = selectedCards[0];
    const newSelected = [firstCard, card];
    setSelectedCards(newSelected);
    setMovesCount((m) => m + 1);

    if (firstCard.pairId === card.pairId) {
      // Match found!
      playSfx("match");
      const nextMatched = new Set(matchedPairIds);
      nextMatched.add(card.pairId);
      setMatchedPairIds(nextMatched);
      setSelectedCards([]);

      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: 50,
        comboMultiplier: 2,
        streak: nextMatched.size,
        consequence: "match",
        message: "Pasangan Cocok! ✓🧩",
      });

      // Check if all pairs are solved or submit correct answer option
      const totalPairs = matchingQuestion.cards.length / 2;
      if (nextMatched.size >= totalPairs && !hasFinished) {
        setHasFinished(true);
        setSubmitting(true);

        const correctOpt =
          question.options.find((o) => o.option_key === question.correct_option_key) ??
          question.options[0];

        await onSubmitAnswer({
          questionId: question.id,
          selectedOptionId: correctOpt?.id ?? null,
          answerText: null,
          responseTimeMs: 2000,
        });

        playSfx("finish");
        setSubmitting(false);
      }
    } else {
      // Mismatch
      playSfx("mismatch");
      onGameEvent?.({
        isCorrect: false,
        scoreAwarded: 0,
        comboMultiplier: 1,
        streak: 0,
        consequence: "mismatch",
        message: "Belum Cocok, Coba Lagi! ❌",
      });

      window.setTimeout(() => {
        setSelectedCards([]);
      }, 700);
    }
  }

  const totalPairs = matchingQuestion.cards.length / 2;

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
        <div>
          Pasangan Ditemukan: <strong className="text-white">{matchedPairIds.size}</strong> / {totalPairs}
        </div>
        <div>Langkah: <strong className="text-white">{movesCount}</strong></div>
      </div>

      {/* Challenge Title */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-5 text-center border border-indigo-500/30">
        <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
          Cocokkan Pasangan Kata
        </span>
        <h2 className="mt-2 text-2xl font-black leading-relaxed text-white sm:text-3xl">
          {matchingQuestion.title}
        </h2>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-2">
        {matchingQuestion.cards.map((card) => {
          const isMatched = matchedPairIds.has(card.pairId);
          const isSelected = selectedCards.some((c) => c.id === card.id);

          return (
            <button
              key={card.id}
              type="button"
              disabled={isMatched || submitting || hasFinished}
              onClick={() => void handleCardClick(card)}
              className={`flex min-h-24 sm:min-h-28 flex-col items-center justify-center rounded-2xl p-4 text-center font-black transition-all duration-200 border-2 active:scale-95 ${
                isMatched
                  ? "border-emerald-400 bg-emerald-600/30 text-emerald-200 opacity-60 cursor-default"
                  : isSelected
                  ? "border-amber-400 bg-amber-500/30 text-white scale-105 shadow-lg shadow-amber-500/20"
                  : "border-slate-700 bg-slate-800/90 text-white hover:border-indigo-400 hover:bg-slate-700"
              }`}
            >
              <span className="text-lg sm:text-xl leading-relaxed">
                {card.text}
              </span>
              {isMatched && (
                <span className="mt-1 text-[10px] text-emerald-400 font-bold uppercase">
                  ✓ Cocok
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
