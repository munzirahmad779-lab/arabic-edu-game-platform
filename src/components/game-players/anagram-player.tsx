"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  id: string;
  option_key: string;
  option_text: string;
};

type Question = {
  id: string;
  question_text: string;
  difficulty: string;
  options: Option[];
};

type AnagramDict = {
  title: string;
  instruction: string;
  hint_label: string;
  submit: string;
  clear: string;
  backspace: string;
  correct: string;
  wrong: string;
  next: string;
  finish: string;
  no_letters: string;
  no_questions: string;
  score_label: string;
  correct_count: string;
  time_label: string;
  shuffled_hint: string;
  skip: string;
};

type Props = {
  questions: Question[];
  dict: AnagramDict;
  onAnswer: (questionId: string, selectedOptionId: string) => Promise<void>;
  onFinish?: (correct: number, total: number) => void;
  isRtl: boolean;
  /**
   * Mode single-question: dipakai saat di game room — soal datang satu per satu
   * dari server. Setelah menjawab, komponen langsung lapor ke parent dan
   * parent akan memuat soal berikutnya.
   */
  singleQuestionMode?: boolean;
  /** Nomor soal saat ini (untuk display "3 / 10") */
  questionNumber?: number;
  /** Total soal (untuk display "3 / 10") */
  totalQuestions?: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

function splitChars(s: string): string[] {
  return Array.from(s);
}

type LetterTile = {
  id: string;
  char: string;
  used: boolean;
};

export function AnagramPlayer({
  questions,
  dict,
  onAnswer,
  onFinish,
  isRtl,
  singleQuestionMode = false,
  questionNumber,
  totalQuestions: totalQuestionsProp,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctAnswerText, setCorrectAnswerText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeStart] = useState(() => Date.now());

  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [slots, setSlots] = useState<(LetterTile | null)[]>([]);
  const [wrongHint, setWrongHint] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const totalQuestions = totalQuestionsProp ?? questions.length;
  const currentQuestion = questions[currentIndex];

  // Untuk single mode: soal pertama = soal aktif (index 0)
  const activeQuestion = singleQuestionMode ? questions[0] : currentQuestion;

  const correctOption = useMemo(() => {
    if (!activeQuestion || activeQuestion.options.length === 0) return null;
    return activeQuestion.options[0];
  }, [activeQuestion]);

  // Init tiles + slots tiap soal baru
  useEffect(() => {
    if (!activeQuestion || !correctOption) return;

    const answerChars = splitChars(correctOption.option_text.trim());

    const newTiles: LetterTile[] = answerChars.map((ch, i) => ({
      id: `t-${i}-${Math.random().toString(36).slice(2, 7)}`,
      char: ch,
      used: false,
    }));

    setTiles(shuffle(newTiles));
    setSlots(new Array(answerChars.length).fill(null));
    setFeedback(null);
    setWrongHint(false);
    setCorrectAnswerText(correctOption.option_text);
  }, [activeQuestion, correctOption]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // ============ AKSI ============
  function pickLetter(tile: LetterTile) {
    if (feedback === "correct" || submitting || tile.used) return;

    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx === -1) return;

    const nextSlots = [...slots];
    nextSlots[emptyIdx] = tile;
    setSlots(nextSlots);

    const nextTiles = tiles.map((t) =>
      t.id === tile.id ? { ...t, used: true } : t,
    );
    setTiles(nextTiles);
    setWrongHint(false);
  }

  function removeFromSlot(slotIndex: number) {
    if (feedback === "correct" || submitting) return;
    const tile = slots[slotIndex];
    if (!tile) return;

    const nextSlots = [...slots];
    nextSlots[slotIndex] = null;
    setSlots(nextSlots);

    const nextTiles = tiles.map((t) =>
      t.id === tile.id ? { ...t, used: false } : t,
    );
    setTiles(nextTiles);
    setWrongHint(false);
  }

  function clearAll() {
    if (feedback === "correct" || submitting) return;
    setSlots(new Array(slots.length).fill(null));
    setTiles(tiles.map((t) => ({ ...t, used: false })));
    setWrongHint(false);
  }

  function backspace() {
    if (feedback === "correct" || submitting) return;
    let lastIdx = -1;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i] !== null) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx === -1) return;
    removeFromSlot(lastIdx);
  }

  async function submit() {
    if (!activeQuestion || submitting) return;

    const hasEmpty = slots.some((s) => s === null);
    if (hasEmpty) {
      setWrongHint(true);
      return;
    }

    const userAnswer = slots.map((s) => s?.char ?? "").join("");
    const isCorrect = userAnswer === correctAnswerText;

    setSubmitting(true);

    const matchedOption =
      activeQuestion.options.find(
        (o) => o.option_text.trim() === userAnswer,
      ) ?? activeQuestion.options[0];

    try {
      await onAnswer(activeQuestion.id, matchedOption.id);
    } catch {
      // ignore
    }

    if (isCorrect) {
      setFeedback("correct");
      setCorrectCount((c) => c + 1);
      timeoutRef.current = window.setTimeout(() => {
        goNext(true);
      }, 900);
    } else {
      setFeedback("wrong");
    }

    setSubmitting(false);
  }

  function goNext(wasCorrect: boolean) {
    const nextCount = wasCorrect ? correctCount + 1 : correctCount;

    // Single mode — lapor ke parent, tidak ada "finished" screen
    if (singleQuestionMode) {
      onFinish?.(nextCount, 1);
      return;
    }

    const nextIdx = currentIndex + 1;
    if (nextIdx >= totalQuestions) {
      setFinished(true);
      onFinish?.(nextCount, totalQuestions);
      return;
    }
    setCurrentIndex(nextIdx);
  }

  function skip() {
    if (submitting) return;
    goNext(false);
  }

  // ============ RENDER: finished (hanya non-single mode) ============
  if (finished && !singleQuestionMode) {
    const percent =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
        <div className="text-6xl">
          {percent >= 90
            ? "🏆"
            : percent >= 70
              ? "🥈"
              : percent >= 50
                ? "🥉"
                : "📚"}
        </div>
        <h1 className="font-display mt-4 text-2xl font-black text-teal-800">
          {dict.finish}
        </h1>
        <p className="mt-2 text-sm text-softslate/80">
          {dict.correct_count}: {correctCount} / {totalQuestions}
        </p>
        <p className="mt-1 text-3xl font-black text-terracotta-600">
          {percent}%
        </p>
      </div>
    );
  }

  if (!activeQuestion || !correctOption) {
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
        <p className="text-sm text-softslate/70">{dict.no_questions}</p>
      </div>
    );
  }

  const displayNumber = singleQuestionMode
    ? (questionNumber ?? 1)
    : currentIndex + 1;

  // ============ RENDER: soal ============
  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-black text-terracotta-700">
            {dict.title}
          </span>
          <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-black text-teal-800">
            {displayNumber} / {totalQuestions}
          </span>
        </div>
        {!singleQuestionMode ? (
          <span className="text-xs font-bold text-softslate/70">
            {dict.correct_count}: {correctCount}
          </span>
        ) : null}
      </div>

      {/* Kartu soal */}
      <div className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-widest text-softslate/60">
          {dict.hint_label}
        </p>
        <h2 className="mt-2 text-center text-lg font-black leading-relaxed text-teal-800 sm:text-xl">
          {activeQuestion.question_text}
        </h2>

        {/* Slot */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {slots.map((s, i) => (
            <button
              key={`slot-${i}`}
              type="button"
              onClick={() => removeFromSlot(i)}
              className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl font-black transition sm:h-16 sm:w-14 ${
                s
                  ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700"
                  : "border-dashed border-sage-300 bg-sage-50/40 text-transparent"
              }`}
              aria-label={s ? s.char : ""}
            >
              {s?.char ?? ""}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {feedback === "wrong" ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm font-bold text-red-700">
            {fmt(dict.wrong, { answer: correctAnswerText })}
          </div>
        ) : null}

        {feedback === "correct" ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-black text-emerald-800">
            {dict.correct}
          </div>
        ) : null}

        {wrongHint && feedback !== "wrong" ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-800">
            {dict.no_letters}
          </div>
        ) : null}

        {/* Huruf */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => pickLetter(tile)}
              disabled={tile.used || feedback === "correct"}
              className={`flex h-14 w-12 items-center justify-center rounded-xl text-2xl font-black shadow-sm transition sm:h-16 sm:w-14 ${
                tile.used
                  ? "cursor-not-allowed bg-sage-100 text-sage-300"
                  : "bg-teal-600 text-white hover:-translate-y-0.5 hover:bg-teal-500"
              }`}
            >
              {tile.char}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-softslate/50">
          {dict.shuffled_hint}
        </p>
      </div>

      {/* Tombol */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={backspace}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border-2 border-sage-200 bg-white px-4 py-3 text-sm font-black text-teal-800 transition hover:bg-sage-50 disabled:opacity-40"
        >
          ⌫ {dict.backspace}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border-2 border-sage-200 bg-white px-4 py-3 text-sm font-black text-teal-800 transition hover:bg-sage-50 disabled:opacity-40"
        >
          🗑 {dict.clear}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
        >
          ⏭ {dict.skip}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          ✓ {dict.submit}
        </button>
      </div>

      {/* Waktu + next */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-xs shadow-sm">
        <span className="font-bold text-softslate/70">
          {dict.time_label}: {Math.floor((Date.now() - timeStart) / 1000)}s
        </span>
        {feedback === "wrong" ? (
          <button
            type="button"
            onClick={() => goNext(false)}
            className="rounded-full bg-teal-700 px-4 py-2 font-black text-white transition hover:bg-teal-600"
          >
            {dict.next} {isRtl ? "←" : "→"}
          </button>
        ) : null}
      </div>
    </div>
  );
}