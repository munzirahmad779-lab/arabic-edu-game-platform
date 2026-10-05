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
  correct_option_key?: string;
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

export type AnswerPayload = {
  questionId: string;
  answerText: string | null;
  selectedOptionId: string | null;
  elapsedMs: number;
};

export type AnswerResult = {
  accepted: boolean;
  isCorrect: boolean;
};

type Props = {
  questions: Question[];
  dict: AnagramDict;
  onAnswer: (payload: AnswerPayload) => Promise<AnswerResult>;
  onFinish?: (correct: number, total: number) => void;
  isRtl: boolean;
  singleQuestionMode?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
};

type FeedbackState = "correct" | "wrong" | "error" | null;

type LetterTile = {
  id: string;
  unit: string;
  used: boolean;
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

function isArabicDiacritic(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06dc) ||
    (code >= 0x06df && code <= 0x06e4) ||
    (code >= 0x06e7 && code <= 0x06e8) ||
    (code >= 0x06ea && code <= 0x06ed)
  );
}

function splitIntoUnits(s: string): string[] {
  const normalized = s.normalize("NFC");
  const result: string[] = [];
  for (const char of Array.from(normalized)) {
    const code = char.codePointAt(0) ?? 0;
    if (isArabicDiacritic(code) && result.length > 0) {
      result[result.length - 1] += char;
    } else {
      result.push(char);
    }
  }
  return result;
}

function hasArabic(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function normalizeAnswer(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

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
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [correctAnswerText, setCorrectAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wrongHint, setWrongHint] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [slots, setSlots] = useState<(LetterTile | null)[]>([]);

  const [timeStart, setTimeStart] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const initializedQuestionKeyRef = useRef<string | null>(null);

  const totalQuestions = totalQuestionsProp ?? questions.length;
  const currentQuestion = questions[currentIndex];
  const activeQuestion = singleQuestionMode ? questions[0] : currentQuestion;
  const activeQuestionId = activeQuestion?.id ?? null;

  // Ambil opsi benar dari correct_option_key (TIDAK pakai options[0])
  const correctOption = useMemo(() => {
    if (!activeQuestion) return null;
    if (!activeQuestion.correct_option_key) return null;
    return (
      activeQuestion.options.find(
        (o) => o.option_key === activeQuestion.correct_option_key,
      ) ?? null
    );
  }, [activeQuestion]);

  // Init tiles — hanya saat soal berubah
  useEffect(() => {
    if (!activeQuestion || !correctOption) return;

    const answerText = normalizeAnswer(correctOption.option_text);
    const questionKey = [
      activeQuestion.id,
      correctOption.id,
      answerText,
    ].join(":");

    if (initializedQuestionKeyRef.current === questionKey) return;
    initializedQuestionKeyRef.current = questionKey;

    const units = splitIntoUnits(answerText);

    const newTiles: LetterTile[] = units.map((u, i) => ({
      id: `tile-${i}-${Math.random().toString(36).slice(2, 8)}`,
      unit: u,
      used: false,
    }));

    setTiles(shuffle(newTiles));
    setSlots(new Array(units.length).fill(null));
    setFeedback(null);
    setWrongHint(false);
    setSaveError(null);

    const now = Date.now();
    setTimeStart(now);
    setElapsedSeconds(0);
  }, [activeQuestion, correctOption]);

  // Timer real
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timeStart) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [finished, timeStart]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const answerIsArabic = hasArabic(correctAnswerText);
  const answerDir = answerIsArabic ? "rtl" : "ltr";

  // ============ AKSI ============
  function pickLetter(tile: LetterTile) {
    if (feedback === "correct" || submitting || tile.used) return;
    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) return;

    const next = [...slots];
    next[idx] = tile;
    setSlots(next);
    setTiles((prev) =>
      prev.map((t) => (t.id === tile.id ? { ...t, used: true } : t)),
    );
    setWrongHint(false);
  }

  function removeFromSlot(i: number) {
    if (feedback === "correct" || submitting) return;
    const tile = slots[i];
    if (!tile) return;
    const next = [...slots];
    next[i] = null;
    setSlots(next);
    setTiles((prev) =>
      prev.map((t) => (t.id === tile.id ? { ...t, used: false } : t)),
    );
    setWrongHint(false);
  }

  function clearAll() {
    if (feedback === "correct" || submitting) return;
    setSlots(new Array(slots.length).fill(null));
    setTiles((prev) => prev.map((t) => ({ ...t, used: false })));
    setWrongHint(false);
  }

  function backspace() {
    if (feedback === "correct" || submitting) return;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i] !== null) {
        removeFromSlot(i);
        return;
      }
    }
  }

  async function submit() {
    if (!activeQuestion || !correctOption || submitting || feedback === "correct")
      return;

    const hasEmpty = slots.some((s) => s === null);
    if (hasEmpty) {
      setWrongHint(true);
      return;
    }

    const userAnswer = normalizeAnswer(
      slots.map((s) => s?.unit ?? "").join(""),
    );

    // Cari option_id kalau userAnswer persis cocok dengan salah satu option
    const matchedOption =
      activeQuestion.options.find(
        (o) => normalizeAnswer(o.option_text) === userAnswer,
      ) ?? null;

    setSubmitting(true);
    setSaveError(null);

    try {
      const result = await onAnswer({
        questionId: activeQuestion.id,
        answerText: userAnswer,
        selectedOptionId: matchedOption?.id ?? null,
        elapsedMs: Date.now() - timeStart,
      });

      if (!result.accepted) {
        setFeedback("error");
        setSaveError("Jawaban belum berhasil disimpan. Coba lagi.");
        return;
      }

      if (result.isCorrect) {
        setFeedback("correct");
        const next = correctCount + 1;
        setCorrectCount(next);
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          goNext(true, next);
        }, 1800);
      } else {
        setFeedback("wrong");
      }
    } catch {
      setFeedback("error");
      setSaveError("Jawaban gagal disimpan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext(wasCorrect: boolean, knownCorrect?: number) {
    const nextCount = knownCorrect ?? (wasCorrect ? correctCount + 1 : correctCount);

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
    if (submitting || feedback === "correct") return;
    goNext(false);
  }

  // ============ RENDER ============
  if (!activeQuestion || !correctOption) {
    return (
      <div className="rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">⚠️</div>
        <p className="mt-3 text-sm font-bold text-red-700">
          {!activeQuestion
            ? dict.no_questions
            : "Soal tidak valid atau jawaban benar belum dikonfigurasi."}
        </p>
      </div>
    );
  }

  if (finished && !singleQuestionMode) {
    const percent =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    return (
      <div className="rounded-[2rem] border border-sage-100 bg-white p-8 text-center shadow-sm">
        <div className="text-6xl">
          {percent >= 90 ? "🏆" : percent >= 70 ? "🥈" : percent >= 50 ? "🥉" : "📚"}
        </div>
        <h1 className="font-display mt-4 text-2xl font-black text-teal-800">
          {dict.finish}
        </h1>
        <p className="mt-2 text-sm text-softslate/80">
          {dict.correct_count}: {correctCount} / {totalQuestions}
        </p>
        <p className="mt-1 text-3xl font-black text-terracotta-600">{percent}%</p>
      </div>
    );
  }

  const displayNumber = singleQuestionMode ? (questionNumber ?? 1) : currentIndex + 1;
  const progress =
    totalQuestions > 0 ? Math.round((displayNumber / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header + progress */}
      <div className="rounded-2xl border border-sage-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-terracotta-50 px-3 py-1 text-xs font-black text-terracotta-700">
              {dict.title}
            </span>
            <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-black text-teal-800">
              {displayNumber} / {totalQuestions}
            </span>
          </div>
          {!singleQuestionMode ? (
            <span className="text-xs font-bold text-softslate/70">
              {dict.correct_count}: {correctCount}
            </span>
          ) : null}
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-sage-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full rounded-full bg-terracotta-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Kartu soal */}
      <div className="rounded-[2rem] border border-sage-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-center text-xs font-black uppercase tracking-[0.15em] text-softslate/60">
          {dict.hint_label}
        </p>
        <h2
          className="mt-2 text-center text-lg font-black leading-relaxed text-teal-800 sm:text-2xl"
          dir={hasArabic(activeQuestion.question_text) ? "rtl" : "ltr"}
        >
          {activeQuestion.question_text}
        </h2>

        <div className="mt-4 flex justify-center">
          <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-black text-teal-800">
            ⏱ {dict.time_label}: {elapsedSeconds}s
          </span>
        </div>

        {/* Slot jawaban */}
        <div className="mt-6 flex min-h-16 flex-wrap justify-center gap-2" dir={answerDir}>
          {slots.map((s, i) => (
            <button
              key={`slot-${i}`}
              type="button"
              onClick={() => removeFromSlot(i)}
              disabled={submitting || feedback === "correct"}
              aria-label={s ? `Hapus ${s.unit}` : `Posisi ${i + 1}`}
              className={`flex h-14 min-w-12 items-center justify-center rounded-xl border-2 px-2 text-2xl font-black transition focus:outline-none focus:ring-2 focus:ring-terracotta-300 disabled:cursor-default sm:h-16 sm:min-w-14 ${
                s
                  ? "border-terracotta-400 bg-terracotta-50 text-terracotta-700"
                  : "border-dashed border-sage-300 bg-sage-50/40"
              }`}
            >
              {s?.unit ?? ""}
            </button>
          ))}
        </div>

        {/* Feedback */}
        <div className="mt-4" aria-live="polite">
          {feedback === "wrong" ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-sm font-bold text-red-700">
              {fmt(dict.wrong, { answer: correctAnswerText })}
            </div>
          ) : null}
          {feedback === "correct" ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-center text-sm font-black text-emerald-800">
              ✅ {dict.correct}
            </div>
          ) : null}
          {feedback === "error" ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-sm font-bold text-red-700">
              {saveError}
            </div>
          ) : null}
          {wrongHint && feedback === null ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center text-xs font-bold text-amber-800">
              {dict.no_letters}
            </div>
          ) : null}
        </div>

        {/* Huruf acak */}
        <div className="mt-6 flex flex-wrap justify-center gap-2" dir={answerDir}>
          {tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pickLetter(t)}
              disabled={t.used || submitting || feedback === "correct"}
              aria-label={`Pilih ${t.unit}`}
              className={`flex h-14 min-w-12 items-center justify-center rounded-xl px-2 text-2xl font-black shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed sm:h-16 sm:min-w-14 ${
                t.used
                  ? "bg-sage-100 text-sage-300"
                  : "bg-teal-700 text-white hover:-translate-y-0.5 hover:bg-teal-600"
              }`}
            >
              {t.unit}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-wide text-softslate/50">
          {dict.shuffled_hint}
        </p>
      </div>

      {/* Tombol aksi */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={backspace}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border border-sage-200 bg-white px-4 py-3 text-sm font-black text-teal-800 transition hover:bg-sage-50 disabled:opacity-40"
        >
          ⌫ {dict.backspace}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border border-sage-200 bg-white px-4 py-3 text-sm font-black text-teal-800 transition hover:bg-sage-50 disabled:opacity-40"
        >
          🗑 {dict.clear}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
        >
          ⏭ {dict.skip}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || feedback === "correct"}
          className="rounded-2xl bg-terracotta-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "..." : `✓ ${dict.submit}`}
        </button>
      </div>
    </div>
  );
}