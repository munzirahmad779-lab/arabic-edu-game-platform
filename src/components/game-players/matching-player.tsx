"use client";

import { useMemo, useState, useEffect } from "react";
import { QuestionAdapter, type MatchingCard } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

interface FeedbackState {
  type: "correct" | "wrong";
  message: string;
  cardIds: string[];
}

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
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Reset when question changes
  useEffect(() => {
    setSelectedCards([]);
    setMatchedPairIds(new Set());
    setMovesCount(0);
    setSubmitting(false);
    setHasFinished(false);
    setFeedback(null);
  }, [question.id]);

  async function handleCardClick(card: MatchingCard) {
    if (
      submitting ||
      hasFinished ||
      feedback !== null || // block clicking during feedback animation
      selectedCards.length >= 2 ||
      matchedPairIds.has(card.pairId)
    ) {
      return;
    }
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
      // MATCH FOUND! (Benar)
      playSfx("match");
      const nextMatched = new Set(matchedPairIds);
      nextMatched.add(card.pairId);

      setFeedback({
        type: "correct",
        message: "🎉 BENAR! Pasangan Cocok! (+50 Poin)",
        cardIds: [firstCard.id, card.id],
      });

      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: 50,
        comboMultiplier: 2,
        streak: nextMatched.size,
        consequence: "match",
        message: "Pasangan Cocok! ✓🧩",
      });

      window.setTimeout(async () => {
        setMatchedPairIds(nextMatched);
        setSelectedCards([]);
        setFeedback(null);

        // Check if all pairs are solved
        const totalPairs = matchingQuestion.targetPairsCount;
        if (nextMatched.size >= totalPairs && !hasFinished) {
          setHasFinished(true);
          setSubmitting(true);

          await onSubmitAnswer({
            questionId: question.id,
            selectedOptionId: matchingQuestion.correctOptionId,
            answerText: null,
            responseTimeMs: 2000,
          });

          playSfx("finish");
          setSubmitting(false);
        }
      }, 700);
    } else {
      // MISMATCH! (Salah)
      playSfx("mismatch");

      setFeedback({
        type: "wrong",
        message: "❌ SALAH / BELUM COCOK! Coba ingat kembali artinya.",
        cardIds: [firstCard.id, card.id],
      });

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
        setFeedback(null);
      }, 900);
    }
  }

  const totalPairs = matchingQuestion.targetPairsCount;

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6 text-white relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
        <div>
          Pasangan Ditemukan: <strong className="text-white">{matchedPairIds.size}</strong> / {totalPairs}
        </div>
        <div>
          Langkah Tebakan: <strong className="text-white">{movesCount}</strong>
        </div>
      </div>

      {/* Challenge Title */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-4 text-center border border-indigo-500/30">
        <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
          🧩 Cocokkan Pasangan Kata Bahasa Arab
        </span>
        <h2 className="mt-2 text-xl font-black leading-relaxed text-white sm:text-2xl">
          {matchingQuestion.title}
        </h2>
      </div>

      {/* Prominent Right/Wrong Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-3 text-center font-black text-sm sm:text-base animate-in zoom-in-95 duration-150 shadow-xl flex items-center justify-center gap-2 border-2 ${
            feedback.type === "correct"
              ? "bg-emerald-600/90 border-emerald-400 text-white shadow-emerald-500/30"
              : "bg-rose-600/90 border-rose-400 text-white shadow-rose-500/30 animate-pulse"
          }`}
        >
          <span>{feedback.type === "correct" ? "✅" : "⚠️"}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Victory Finish Overlay */}
      {hasFinished && (
        <div className="rounded-2xl p-4 bg-emerald-950/90 border-2 border-emerald-400 text-center animate-in zoom-in duration-200">
          <div className="text-4xl animate-bounce">🏆🎉</div>
          <div className="text-xl font-black text-emerald-300 mt-1">
            SEMUA PASANGAN BERHASIL DICOCOKKAN!
          </div>
          <p className="text-xs text-white/80 mt-0.5">
            Hebat sekali! Skor telah ditambahkan ke tim Anda.
          </p>
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-1">
        {matchingQuestion.cards.map((card) => {
          const isMatched = matchedPairIds.has(card.pairId);
          const isSelected = selectedCards.some((c) => c.id === card.id);
          const isFeedbackCard = feedback?.cardIds.includes(card.id);

          let cardStyle = "border-slate-700 bg-slate-800/90 text-white hover:border-indigo-400 hover:bg-slate-700 cursor-pointer";

          if (isMatched) {
            cardStyle = "border-emerald-400 bg-emerald-600/30 text-emerald-200 opacity-60 cursor-default";
          } else if (isFeedbackCard) {
            if (feedback?.type === "correct") {
              cardStyle = "border-emerald-400 bg-emerald-500/60 text-white scale-105 shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400";
            } else {
              cardStyle = "border-rose-500 bg-rose-600/60 text-white scale-98 shadow-xl shadow-rose-500/40 ring-4 ring-rose-500";
            }
          } else if (isSelected) {
            cardStyle = "border-amber-400 bg-amber-500/40 text-white scale-105 shadow-lg shadow-amber-500/20 ring-2 ring-amber-300";
          }

          return (
            <button
              key={card.id}
              type="button"
              disabled={isMatched || submitting || hasFinished}
              onClick={() => void handleCardClick(card)}
              className={`flex min-h-24 sm:min-h-28 flex-col items-center justify-center rounded-2xl p-4 text-center font-black transition-all duration-200 border-2 active:scale-95 ${cardStyle}`}
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
