"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Confetti } from "@/components/confetti";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { PracticeQuestion, PracticeTopicData } from "./practice-data";

interface PracticePlayerProps {
  topic: PracticeTopicData;
  isRtl?: boolean;
}

export function PracticePlayer({ topic, isRtl = false }: PracticePlayerProps) {
  const router = useRouter();

  // Practice state
  const [questionsQueue, setQuestionsQueue] = useState<PracticeQuestion[]>(
    topic.questions,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // Current question user interaction state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [scrambleAssembled, setScrambleAssembled] = useState<string[]>([]);
  const [scrambleBank, setScrambleBank] = useState<string[]>([]);

  // Feedback state
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "correct" | "wrong"
  >("idle");
  const [isFinished, setIsFinished] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const activeQuestion = questionsQueue[currentIndex] ?? null;

  // Initialize word scramble bank whenever question changes
  useEffect(() => {
    if (activeQuestion && activeQuestion.type === "word-scramble") {
      setScrambleBank([...(activeQuestion.scrambleWords ?? [])]);
      setScrambleAssembled([]);
    } else {
      setSelectedOptionId(null);
    }
    setFeedbackState("idle");
  }, [activeQuestion]);

  // Audio Speech synthesis for Arabic pronunciation
  const speakArabic = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.85; // slightly slower for educational clarity
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synth error
    }
  }, []);

  // Play audio automatically when a question with audioText appears
  useEffect(() => {
    if (activeQuestion?.audioText) {
      const timer = setTimeout(() => {
        speakArabic(activeQuestion.audioText!);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeQuestion, speakArabic]);

  // Handle assembling word scramble
  const handleBankWordClick = (word: string, index: number) => {
    if (feedbackState !== "idle") return;
    playSfx("click");
    setScrambleBank((prev) => prev.filter((_, i) => i !== index));
    setScrambleAssembled((prev) => [...prev, word]);
  };

  const handleAssembledWordClick = (word: string, index: number) => {
    if (feedbackState !== "idle") return;
    playSfx("click");
    setScrambleAssembled((prev) => prev.filter((_, i) => i !== index));
    setScrambleBank((prev) => [...prev, word]);
  };

  // Check answer logic
  const handleCheckAnswer = () => {
    if (!activeQuestion || feedbackState !== "idle") return;

    let isCorrect = false;

    if (activeQuestion.type === "multiple-choice") {
      isCorrect = selectedOptionId === activeQuestion.correctOptionId;
    } else if (activeQuestion.type === "word-scramble") {
      const assembledText = scrambleAssembled.join(" ").trim();
      const targetText = activeQuestion.targetSentence?.trim() ?? "";
      isCorrect = assembledText === targetText;
    }

    if (isCorrect) {
      playSfx("correct");
      const streakBonus = Math.min(streak * 20, 100);
      const points = 100 + streakBonus;
      setScore((s) => s + points);
      setStreak((st) => st + 1);
      setCorrectCount((c) => c + 1);
      setFeedbackState("correct");
    } else {
      playSfx("wrong");
      setStreak(0);
      setWrongCount((w) => w + 1);
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setFeedbackState("wrong");

      // Add question to end of queue for redemption round!
      setQuestionsQueue((prev) => [...prev, activeQuestion]);

      if (newHearts <= 0) {
        setIsGameOver(true);
      }
    }
  };

  // Advance to next question in queue
  const handleNextQuestion = () => {
    if (isGameOver) return;

    if (currentIndex + 1 < questionsQueue.length) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      setIsFinished(true);
      playSfx("finish");
    }
  };

  // Keyboard shortcut (Enter to check or advance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (feedbackState === "idle") {
          const canCheck =
            (activeQuestion?.type === "multiple-choice" && selectedOptionId) ||
            (activeQuestion?.type === "word-scramble" &&
              scrambleAssembled.length > 0);
          if (canCheck) handleCheckAnswer();
        } else {
          handleNextQuestion();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Calculate progress percentage
  const totalOriginal = topic.questions.length;
  const progressPercent = Math.min(
    Math.round((correctCount / totalOriginal) * 100),
    100,
  );

  // 1. GAME OVER VIEW (Out of hearts)
  if (isGameOver) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warmwhite p-4">
        <div className="w-full max-w-md rounded-3xl border border-terracotta-200 bg-white p-8 text-center shadow-2xl">
          <div className="text-6xl animate-bounce">💔</div>
          <h2 className="font-display mt-4 text-2xl font-black text-teal-900">
            {isRtl ? "نفدت القلوب!" : "Nyawa Latihan Habis!"}
          </h2>
          <p className="mt-2 text-sm text-softslate">
            {isRtl
              ? "لا تقلق! التعلم يحتاج إلى تكرار وصبر. استعد قلوبك وواصل من حيث توقفت."
              : "Jangan berkecil hati, belajar bahasa Arab adalah proses istiqamah. Isi ulang nyawamu dan lanjutkan latihan!"}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setHearts(3);
                setIsGameOver(false);
                setFeedbackState("idle");
              }}
              className="w-full rounded-2xl bg-terracotta-500 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-terracotta-600 active:scale-95"
            >
              ❤️ {isRtl ? "إعادة ملء القلوب والمتابعة" : "Isi Ulang Nyawa (3 ❤️) & Lanjut"}
            </button>
            <Link
              href="/practice"
              className="w-full rounded-2xl border border-sage-200 py-3 text-sm font-bold text-teal-800 transition hover:bg-sage-50"
            >
              {isRtl ? "العودة لقائمة المواضيع" : "Kembali ke Katalog Topik"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. FINISHED LESSON VIEW (Celebration)
  if (isFinished) {
    const accuracy =
      totalOriginal > 0
        ? Math.round(
            (correctCount / (correctCount + wrongCount || 1)) * 100,
          )
        : 100;
    const stars = accuracy >= 85 ? 3 : accuracy >= 60 ? 2 : 1;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-cream via-white to-sage-50 p-4 text-center">
        <Confetti active={true} particleCount={250} originY={0.8} />

        <div className="relative z-10 w-full max-w-lg rounded-[2.5rem] border border-sage-200 bg-white p-8 shadow-2xl sm:p-10">
          <div className="text-7xl">
            {stars === 3 ? "🏆" : stars === 2 ? "🌟" : "👍"}
          </div>

          <div className="mt-3 flex justify-center gap-1.5 text-3xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={i < stars ? "text-amber-400" : "text-gray-300 opacity-40"}
              >
                ★
              </span>
            ))}
          </div>

          <h2 className="font-display mt-4 text-3xl font-black text-teal-900">
            {isRtl ? "أحسنت! أتممت التدريب بنجاح" : "Mumtaz! Latihan Selesai"}
          </h2>
          <p className="font-arabic mt-1 text-xl font-bold text-teal-700" dir="rtl">
            {topic.titleAr}
          </p>

          {/* Stats Grid */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <span className="text-xs font-bold text-amber-800">Total XP</span>
              <p className="mt-1 font-mono text-2xl font-black text-amber-900">
                +{score}
              </p>
            </div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-3">
              <span className="text-xs font-bold text-teal-800">Akurasi</span>
              <p className="mt-1 font-mono text-2xl font-black text-teal-900">
                {accuracy}%
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <span className="text-xs font-bold text-rose-800">Sisa Nyawa</span>
              <p className="mt-1 font-mono text-2xl font-black text-rose-900">
                {hearts} ❤️
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setQuestionsQueue(topic.questions);
                setCurrentIndex(0);
                setHearts(3);
                setStreak(0);
                setScore(0);
                setCorrectCount(0);
                setWrongCount(0);
                setIsFinished(false);
                setFeedbackState("idle");
              }}
              className="w-full rounded-2xl bg-terracotta-500 py-4 text-sm font-black text-white shadow-lg transition hover:bg-terracotta-600 active:scale-95"
            >
              🔄 {isRtl ? "إعادة التدريب لترسيخ الحفظ" : "Ulangi Latihan Topik Ini"}
            </button>

            <Link
              href="/practice"
              className="w-full rounded-2xl border border-sage-300 bg-white py-3.5 text-sm font-bold text-teal-800 transition hover:bg-sage-50"
            >
              📚 {isRtl ? "اختيار موضوع آخر" : "Pilih Topik Latihan Lainnya"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. ACTIVE PRACTICE VIEW
  return (
    <div
      className="min-h-screen flex flex-col justify-between bg-warmwhite text-ink selection:bg-teal-100"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* TOP HEADER HUD */}
      <header className="sticky top-0 z-20 border-b border-sage-200/80 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {/* Exit Button */}
          <Link
            href="/practice"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sage-200 bg-white text-softslate transition hover:border-terracotta-400 hover:text-terracotta-600"
            title="Keluar latihan"
          >
            ✕
          </Link>

          {/* Progress Bar */}
          <div className="flex-1">
            <div className="h-4 w-full overflow-hidden rounded-full border border-sage-200 bg-cream">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* HUD Indicators: Streak & Hearts */}
          <div className="flex items-center gap-3">
            {streak > 1 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 animate-pulse">
                🔥 {streak}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
              ❤️ {hearts}
            </span>
          </div>
        </div>
      </header>

      {/* QUESTION MAIN ARENA */}
      <main className="mx-auto my-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        {activeQuestion && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Prompt Header */}
            <div>
              <span className="inline-block rounded-full border border-teal-200 bg-teal-50 px-3 py-0.5 text-xs font-bold text-teal-800">
                {activeQuestion.type === "word-scramble"
                  ? "🧩 Susun Kalimat Arab"
                  : "📝 Pilihan Ganda"}
              </span>
              <h1 className="font-display mt-2 text-xl font-black text-teal-950 sm:text-2xl">
                {activeQuestion.prompt}
              </h1>
            </div>

            {/* Arabic Word / Prompt Card (if provided) */}
            {activeQuestion.promptAr && (
              <div className="relative rounded-3xl border border-sage-200/80 bg-white p-6 text-center shadow-sm sm:p-8">
                <div className="flex items-center justify-center gap-3">
                  <h2
                    className="font-arabic text-4xl font-bold leading-relaxed text-teal-900 sm:text-5xl"
                    dir="rtl"
                  >
                    {activeQuestion.promptAr}
                  </h2>
                  {activeQuestion.audioText && (
                    <button
                      type="button"
                      onClick={() => speakArabic(activeQuestion.audioText!)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-xl text-teal-700 shadow-sm transition hover:scale-105 hover:bg-teal-100 active:scale-95"
                      title="Dengarkan pelafalan"
                    >
                      🔊
                    </button>
                  )}
                </div>
                {activeQuestion.phonetic && (
                  <p className="mt-2 text-xs font-bold text-softslate/80">
                    Pelafalan: <span className="text-teal-700 font-mono">[{activeQuestion.phonetic}]</span>
                  </p>
                )}
              </div>
            )}

            {/* TYPE 1: MULTIPLE CHOICE OPTIONS */}
            {activeQuestion.type === "multiple-choice" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeQuestion.options?.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  let cardStyle =
                    "border-sage-200 bg-white text-ink hover:border-terracotta-400 hover:bg-cream/40";

                  if (isSelected && feedbackState === "idle") {
                    cardStyle =
                      "border-teal-600 bg-teal-50/70 text-teal-950 ring-2 ring-teal-500/20";
                  } else if (feedbackState !== "idle") {
                    if (opt.id === activeQuestion.correctOptionId) {
                      cardStyle =
                        "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30";
                    } else if (isSelected && feedbackState === "wrong") {
                      cardStyle =
                        "border-rose-400 bg-rose-50 text-rose-950 ring-2 ring-rose-400/30";
                    } else {
                      cardStyle = "opacity-40 border-sage-100 bg-white";
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={feedbackState !== "idle"}
                      onClick={() => {
                        playSfx("click");
                        setSelectedOptionId(opt.id);
                        if (opt.textAr) speakArabic(opt.textAr);
                      }}
                      className={`flex items-center gap-3.5 rounded-2xl border-2 p-4 text-start font-bold transition-all active:scale-[0.98] ${cardStyle}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cream font-mono text-xs font-black uppercase text-teal-800">
                        {opt.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-black">{opt.text}</p>
                        {opt.textAr && (
                          <p className="font-arabic mt-0.5 text-base text-teal-700 font-bold" dir="rtl">
                            {opt.textAr}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* TYPE 2: WORD SCRAMBLE INTERFACE */}
            {activeQuestion.type === "word-scramble" && (
              <div className="space-y-6">
                {/* Assembly Target Slot */}
                <div className="min-h-[72px] rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-3 flex flex-wrap items-center gap-2.5 justify-center" dir="rtl">
                  {scrambleAssembled.length === 0 ? (
                    <span className="text-xs font-bold text-softslate/70" dir="ltr">
                      Ketuk kata di bawah untuk menyusun kalimat...
                    </span>
                  ) : (
                    scrambleAssembled.map((word, idx) => (
                      <button
                        key={`${word}-${idx}`}
                        type="button"
                        disabled={feedbackState !== "idle"}
                        onClick={() => handleAssembledWordClick(word, idx)}
                        className="rounded-xl border border-teal-300 bg-white px-4 py-2 font-arabic text-lg font-bold text-teal-900 shadow-sm transition hover:border-rose-300 hover:text-rose-600 active:scale-95"
                      >
                        {word}
                      </button>
                    ))
                  )}
                </div>

                {/* Scramble Token Bank */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2" dir="rtl">
                  {scrambleBank.map((word, idx) => (
                    <button
                      key={`${word}-${idx}`}
                      type="button"
                      disabled={feedbackState !== "idle"}
                      onClick={() => handleBankWordClick(word, idx)}
                      className="rounded-xl border-2 border-sage-200 bg-white px-4 py-2.5 font-arabic text-lg font-bold text-teal-950 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta-500 hover:shadow-md active:scale-95"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM ACTION / FEEDBACK DRAWER */}
      <footer
        className={`sticky bottom-0 z-30 border-t transition-all duration-300 ${
          feedbackState === "correct"
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : feedbackState === "wrong"
              ? "border-rose-200 bg-rose-50 text-rose-950"
              : "border-sage-200/80 bg-white text-ink"
        }`}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Explanation if Feedback Active */}
          {feedbackState !== "idle" ? (
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {feedbackState === "correct" ? "🎉" : "💡"}
                </span>
                <span className="text-base font-black">
                  {feedbackState === "correct"
                    ? isRtl
                      ? "إجابة صحيحة وممتازة! (+100 XP)"
                      : "Mumtaz! Jawabanmu Tepat Sekali (+100 XP)"
                    : isRtl
                      ? "إجابة غير دقيقة!"
                      : "Kurang Tepat, Jangan Menyerah!"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {activeQuestion?.explanation}
              </p>
            </div>
          ) : (
            <div className="hidden sm:block text-xs font-bold text-softslate/70">
              💡 Tekan <kbd className="rounded border bg-warmwhite px-1.5 py-0.5 font-mono">Enter</kbd> untuk memeriksa
            </div>
          )}

          {/* Primary Action Button */}
          {feedbackState === "idle" ? (
            <button
              type="button"
              onClick={handleCheckAnswer}
              disabled={
                activeQuestion?.type === "multiple-choice"
                  ? !selectedOptionId
                  : scrambleAssembled.length === 0
              }
              className="w-full sm:w-auto min-w-[160px] rounded-2xl bg-terracotta-500 py-3.5 px-6 text-center text-sm font-black text-white shadow-md shadow-terracotta-500/20 transition hover:bg-terracotta-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isRtl ? "تحقق من الإجابة" : "Periksa Jawaban"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextQuestion}
              className={`w-full sm:w-auto min-w-[160px] rounded-2xl py-3.5 px-6 text-center text-sm font-black text-white shadow-md transition active:scale-95 ${
                feedbackState === "correct"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {isRtl ? "السؤال التالي ←" : "Lanjut Soal Berikutnya →"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
