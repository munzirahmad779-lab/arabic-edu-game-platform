"use client";

import { useMemo, useState, useEffect } from "react";
import { QuestionAdapter, type MatchingCard } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

interface FeedbackState {
  type: "correct" | "wrong";
  message: string;
  cardIds: string[];
  hintCardId?: string;
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
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // List of solved pairs for the visual progress panel
  const solvedPairsList = useMemo(() => {
    const list: Array<{ prompt: string; target: string }> = [];
    matchedPairIds.forEach((pairId) => {
      const pairCards = matchingQuestion.cards.filter((c) => c.pairId === pairId);
      const prompt = pairCards.find((c) => c.role === "prompt") || pairCards[0];
      const target = pairCards.find((c) => c.role === "target" && c.id !== prompt?.id) || pairCards[1];
      if (prompt && target) {
        list.push({ prompt: prompt.text, target: target.text });
      }
    });
    return list;
  }, [matchedPairIds, matchingQuestion]);

  // List of all correct pairs for educational review
  const allPairsList = useMemo(() => {
    const list: Array<{ prompt: string; target: string }> = [];
    const pairIds = Array.from(new Set(matchingQuestion.cards.map((c) => c.pairId)));
    pairIds.forEach((pairId) => {
      if (pairId.startsWith("decoy_")) return;
      const pairCards = matchingQuestion.cards.filter((c) => c.pairId === pairId);
      const prompt = pairCards.find((c) => c.role === "prompt") || pairCards[0];
      const target = pairCards.find((c) => c.role === "target" && c.id !== prompt?.id) || pairCards[1];
      if (prompt && target) {
        list.push({ prompt: prompt.text, target: target.text });
      }
    });
    return list;
  }, [matchingQuestion]);

  // Reset when question changes
  useEffect(() => {
    setSelectedCards([]);
    setMatchedPairIds(new Set());
    setMovesCount(0);
    setSubmitting(false);
    setHasFinished(false);
    setFeedback(null);
    setShowAnswerKey(false);
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
        message: `🎉 BENAR! Pasangan Cocok: "${firstCard.text}" ↔ "${card.text}" (+50 Poin)`,
        cardIds: [firstCard.id, card.id],
      });

      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: 50,
        comboMultiplier: 2,
        streak: nextMatched.size,
        consequence: "match",
        message: `Pasangan Cocok: ${firstCard.text} ✓`,
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
      }, 900);
    } else {
      // MISMATCH! (Salah)
      playSfx("mismatch");

      let wrongMsg = `❌ SALAH! "${firstCard.text}" bukan pasangan dari "${card.text}".`;
      let hintCard: MatchingCard | undefined = undefined;

      const partnerOfFirst = matchingQuestion.cards.find(
        (c) => c.pairId === firstCard.pairId && c.id !== firstCard.id,
      );
      const partnerOfSecond = matchingQuestion.cards.find(
        (c) => c.pairId === card.pairId && c.id !== card.id,
      );

      if (partnerOfFirst) {
        hintCard = partnerOfFirst;
        wrongMsg += ` Pasangan yang benar adalah "${firstCard.text}" ↔ "${partnerOfFirst.text}"!`;
      } else if (partnerOfSecond) {
        hintCard = partnerOfSecond;
        wrongMsg += ` Pasangan yang benar adalah "${card.text}" ↔ "${partnerOfSecond.text}"!`;
      } else {
        // Both are distractors/decoys! Find the primary prompt and its target
        const promptCard = matchingQuestion.cards.find((c) => c.role === "prompt");
        const correctTarget = matchingQuestion.cards.find(
          (c) => c.role === "target" && c.pairId === promptCard?.pairId,
        );
        if (promptCard && correctTarget) {
          hintCard = correctTarget;
          wrongMsg += ` Pasangan yang benar adalah "${promptCard.text}" ↔ "${correctTarget.text}"!`;
        }
      }

      setFeedback({
        type: "wrong",
        message: wrongMsg,
        cardIds: [firstCard.id, card.id],
        hintCardId: hintCard?.id,
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
      }, 2000);
    }
  }

  const totalPairs = matchingQuestion.targetPairsCount;

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6 text-white relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-indigo-300">
        <div>
          Pasangan Ditemukan: <strong className="text-white">{matchedPairIds.size}</strong> / {totalPairs}
        </div>
        <div className="flex items-center gap-3">
          <div>
            Langkah Tebakan: <strong className="text-white">{movesCount}</strong>
          </div>
          <button
            type="button"
            onClick={() => setShowAnswerKey((v) => !v)}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-white/20 transition"
          >
            {showAnswerKey ? "Tutup Kunci" : "💡 Kunci Jawaban"}
          </button>
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

      {/* Educational Answer Key Cheat Sheet (Toggleable) */}
      {showAnswerKey && (
        <div className="rounded-2xl bg-slate-800/90 p-4 border border-indigo-400/40 text-xs animate-in fade-in duration-200">
          <div className="font-black text-amber-300 mb-2 flex items-center gap-1.5">
            <span>💡</span>
            <span>KUNCI JAWABAN PASANGAN KATA BAHASA ARAB:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allPairsList.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 border border-white/10"
              >
                <span className="font-bold text-emerald-300 text-sm">{p.prompt}</span>
                <span className="text-slate-400 font-bold">⟷</span>
                <span className="font-bold text-sky-200 text-sm">{p.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prominent Right/Wrong Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-3 text-center font-black text-xs sm:text-sm animate-in zoom-in-95 duration-150 shadow-xl flex items-center justify-center gap-2 border-2 ${
            feedback.type === "correct"
              ? "bg-emerald-600/95 border-emerald-400 text-white shadow-emerald-500/30"
              : "bg-rose-600/95 border-rose-400 text-white shadow-rose-500/30 animate-pulse"
          }`}
        >
          <span>{feedback.type === "correct" ? "✅" : "⚠️"}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Solved Pairs Progression Panel */}
      {solvedPairsList.length > 0 && (
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/30 p-3">
          <div className="text-[11px] font-bold text-emerald-300 mb-1.5 flex items-center gap-1.5">
            <span>✓</span>
            <span>Pasangan yang Sudah Terpecahkan ({solvedPairsList.length}):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {solvedPairsList.map((pair, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-200 border border-emerald-400/30"
              >
                <span className="font-semibold text-white">{pair.prompt}</span>
                <span className="text-emerald-400 font-black">⟷</span>
                <span className="font-semibold text-emerald-200">{pair.target}</span>
              </span>
            ))}
          </div>
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
          const isHintCard = feedback?.hintCardId === card.id;

          let cardStyle = "border-slate-700 bg-slate-800/90 text-white hover:border-indigo-400 hover:bg-slate-700 cursor-pointer";

          if (isMatched) {
            cardStyle = "border-emerald-400 bg-emerald-600/30 text-emerald-200 opacity-60 cursor-default";
          } else if (isHintCard) {
            cardStyle = "border-amber-400 bg-amber-500/30 text-amber-100 scale-105 shadow-2xl shadow-amber-400/50 ring-4 ring-amber-400 animate-pulse";
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
              {isHintCard && (
                <span className="mt-1 text-[10px] text-amber-300 font-black uppercase tracking-wider bg-black/50 px-2 py-0.5 rounded">
                  💡 Pasangan Benar
                </span>
              )}
              {isFeedbackCard && feedback?.type === "wrong" && (
                <span className="mt-1 text-[10px] text-rose-300 font-black uppercase tracking-wider bg-black/50 px-2 py-0.5 rounded">
                  ❌ Salah
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
