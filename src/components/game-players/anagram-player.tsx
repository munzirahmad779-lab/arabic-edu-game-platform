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
  timeLimitSeconds?: number | null;
};

type FeedbackState =
  | "correct"
  | "wrong"
  | "skipped"
  | "error"
  | null;

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

function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  let out = template;

  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(
      new RegExp(`\\{${key}\\}`, "g"),
      String(value),
    );
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

function splitIntoUnits(value: string): string[] {
  const normalized = value.normalize("NFC");
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

function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function normalizeAnswer(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
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
  timeLimitSeconds,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [feedback, setFeedback] =
    useState<FeedbackState>(null);

  const [correctAnswerText, setCorrectAnswerText] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [finished, setFinished] =
    useState(false);

  const [wrongHint, setWrongHint] =
    useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [tiles, setTiles] =
    useState<LetterTile[]>([]);

  const [slots, setSlots] =
    useState<(LetterTile | null)[]>([]);

  const [timeStart, setTimeStart] =
    useState(() => Date.now());

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [remainingSeconds, setRemainingSeconds] =
    useState<number | null>(
      timeLimitSeconds ?? null,
    );

  const timeoutRef =
    useRef<number | null>(null);

  const initializedQuestionKeyRef =
    useRef<string | null>(null);

  const totalQuestions =
    totalQuestionsProp ?? questions.length;

  const currentQuestion =
    questions[currentIndex];

  const activeQuestion =
    singleQuestionMode
      ? questions[0]
      : currentQuestion;

  const correctOption = useMemo(() => {
    if (
      !activeQuestion?.correct_option_key
    ) {
      return null;
    }

    return (
      activeQuestion.options.find(
        (option) =>
          option.option_key ===
          activeQuestion.correct_option_key,
      ) ?? null
    );
  }, [activeQuestion]);

  useEffect(() => {
    if (!activeQuestion || !correctOption) {
      return;
    }

    const answerText =
      normalizeAnswer(
        correctOption.option_text,
      );

    const questionKey =
      `${activeQuestion.id}:${correctOption.id}:${answerText}`;

    if (
      initializedQuestionKeyRef.current ===
      questionKey
    ) {
      return;
    }

    initializedQuestionKeyRef.current =
      questionKey;

    const units =
      splitIntoUnits(answerText);

    const newTiles: LetterTile[] =
      units.map((unit, index) => ({
        id:
          `tile-${index}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        unit,
        used: false,
      }));

    setTiles(shuffle(newTiles));
    setSlots(
      new Array(units.length).fill(null),
    );
    setCorrectAnswerText(answerText);

    setFeedback(null);
    setWrongHint(false);
    setSaveError(null);

    const now = Date.now();

    setTimeStart(now);
    setElapsedSeconds(0);
    setRemainingSeconds(
      timeLimitSeconds ?? null,
    );
  }, [
    activeQuestion,
    correctOption,
    timeLimitSeconds,
  ]);

  useEffect(() => {
    if (finished) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - timeStart) / 1000,
        );

        setElapsedSeconds(elapsed);

        if (timeLimitSeconds != null) {
          setRemainingSeconds(
            Math.max(
              0,
              timeLimitSeconds - elapsed,
            ),
          );
        }
      }, 250);

    return () =>
      window.clearInterval(intervalId);
  }, [
    finished,
    timeStart,
    timeLimitSeconds,
  ]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(
          timeoutRef.current,
        );
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        submitting ||
        feedback !== null
      ) {
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
  });

  const answerDir =
    hasArabic(correctAnswerText)
      ? "rtl"
      : "ltr";

  const displayNumber =
    singleQuestionMode
      ? (questionNumber ?? 1)
      : currentIndex + 1;

  const progress =
    totalQuestions > 0
      ? Math.min(
          100,
          Math.round(
            (displayNumber /
              totalQuestions) *
              100,
          ),
        )
      : 0;

  const isTimeUp =
    timeLimitSeconds != null &&
    remainingSeconds !== null &&
    remainingSeconds <= 0;

  const timerProgress =
    timeLimitSeconds != null &&
    timeLimitSeconds > 0 &&
    remainingSeconds !== null
      ? Math.max(
          0,
          Math.min(
            100,
            (remainingSeconds /
              timeLimitSeconds) *
              100,
          ),
        )
      : null;

  function pickLetter(
    tile: LetterTile,
  ) {
    if (
      submitting ||
      feedback !== null ||
      isTimeUp ||
      tile.used
    ) {
      return;
    }

    const index =
      slots.findIndex(
        (slot) => slot === null,
      );

    if (index === -1) {
      return;
    }

    const nextSlots = [...slots];

    nextSlots[index] = tile;

    setSlots(nextSlots);

    setTiles((previous) =>
      previous.map((item) =>
        item.id === tile.id
          ? {
              ...item,
              used: true,
            }
          : item,
      ),
    );

    setWrongHint(false);
  }

  function removeFromSlot(
    index: number,
  ) {
    if (
      submitting ||
      feedback !== null ||
      isTimeUp
    ) {
      return;
    }

    const tile = slots[index];

    if (!tile) {
      return;
    }

    const nextSlots = [...slots];

    nextSlots[index] = null;

    setSlots(nextSlots);

    setTiles((previous) =>
      previous.map((item) =>
        item.id === tile.id
          ? {
              ...item,
              used: false,
            }
          : item,
      ),
    );

    setWrongHint(false);
  }

  function clearAll() {
    if (
      submitting ||
      feedback !== null ||
      isTimeUp
    ) {
      return;
    }

    setSlots(
      new Array(slots.length).fill(null),
    );

    setTiles((previous) =>
      previous.map((tile) => ({
        ...tile,
        used: false,
      })),
    );

    setWrongHint(false);
  }

  function backspace() {
    if (
      submitting ||
      feedback !== null ||
      isTimeUp
    ) {
      return;
    }

    for (
      let index = slots.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (slots[index] !== null) {
        removeFromSlot(index);
        return;
      }
    }
  }

  async function submit() {
    if (
      !activeQuestion ||
      !correctOption ||
      submitting ||
      feedback !== null ||
      isTimeUp
    ) {
      return;
    }

    if (
      slots.some(
        (slot) => slot === null,
      )
    ) {
      setWrongHint(true);
      return;
    }

    const userAnswer =
      normalizeAnswer(
        slots
          .map(
            (slot) =>
              slot?.unit ?? "",
          )
          .join(""),
      );

    const matchedOption =
      activeQuestion.options.find(
        (option) =>
          normalizeAnswer(
            option.option_text,
          ) === userAnswer,
      ) ?? null;

    setSubmitting(true);
    setSaveError(null);

    try {
      const result =
        await onAnswer({
          questionId:
            activeQuestion.id,
          answerText: userAnswer,
          selectedOptionId:
            matchedOption?.id ?? null,
          elapsedMs:
            Date.now() - timeStart,
        });

      if (!result.accepted) {
        setFeedback("error");
        setSaveError(
          "Jawaban belum berhasil disimpan. Coba lagi.",
        );
        return;
      }

      if (result.isCorrect) {
        const nextCorrect =
          correctCount + 1;

        setCorrectCount(
          nextCorrect,
        );

        setFeedback("correct");

        timeoutRef.current =
          window.setTimeout(() => {
            timeoutRef.current = null;

            goNext(
              true,
              nextCorrect,
            );
          }, 1400);
      } else {
        setFeedback("wrong");
      }
    } catch {
      setFeedback("error");

      setSaveError(
        "Jawaban gagal disimpan. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function skip() {
    if (
      !activeQuestion ||
      submitting ||
      feedback !== null ||
      isTimeUp
    ) {
      return;
    }

    setSubmitting(true);
    setSaveError(null);

    try {
      const result =
        await onAnswer({
          questionId:
            activeQuestion.id,
          answerText: null,
          selectedOptionId: null,
          elapsedMs:
            Date.now() - timeStart,
        });

      if (!result.accepted) {
        setFeedback("error");
        setSaveError(
          "Jawaban belum berhasil disimpan. Coba lagi.",
        );
        return;
      }

      setFeedback("skipped");

      goNext(false);
    } catch {
      setFeedback("error");

      setSaveError(
        "Jawaban gagal disimpan. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function goNext(
    wasCorrect: boolean,
    knownCorrect?: number,
  ) {
    const nextCorrect =
      knownCorrect ??
      (wasCorrect
        ? correctCount + 1
        : correctCount);

    if (singleQuestionMode) {
      onFinish?.(
        nextCorrect,
        1,
      );
      return;
    }

    const nextIndex =
      currentIndex + 1;

    if (
      nextIndex >= totalQuestions
    ) {
      setFinished(true);

      onFinish?.(
        nextCorrect,
        totalQuestions,
      );

      return;
    }

    setCurrentIndex(nextIndex);
  }

  if (
    !activeQuestion ||
    !correctOption
  ) {
    return (
      <div
        className="rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-sm"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="text-4xl">
          ⚠️
        </div>

        <p className="mt-3 text-sm font-bold text-rose-700">
          {!activeQuestion
            ? dict.no_questions
            : "Soal tidak valid atau jawaban benar belum dikonfigurasi."}
        </p>
      </div>
    );
  }

  if (
    finished &&
    !singleQuestionMode
  ) {
    const percent =
      totalQuestions > 0
        ? Math.round(
            (correctCount /
              totalQuestions) *
              100,
          )
        : 0;

    return (
      <div
        className="rounded-[2rem] border border-white/20 bg-white p-8 text-center shadow-xl"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-5xl">
          {percent >= 90
            ? "🏆"
            : percent >= 70
              ? "🥈"
              : percent >= 50
                ? "🥉"
                : "📚"}
        </div>

        <h1 className="mt-5 font-display text-2xl font-black text-teal-800">
          {dict.finish}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {dict.correct_count}:{" "}
          {correctCount} / {totalQuestions}
        </p>

        <p className="mt-2 text-4xl font-black text-terracotta-600">
          {percent}%
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* GAME HUD */}
      <header className="overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-teal-800">
                {dict.title}
              </span>

              <span className="rounded-full bg-teal-950/20 px-3 py-1 text-[11px] font-black text-white/90">
                {displayNumber} / {totalQuestions}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-2xl bg-white/15 px-3 py-2 text-center">
              <div className="text-[9px] font-bold text-white/60">
                {dict.score_label}
              </div>

              <div className="text-sm font-black text-white">
                {correctCount}
              </div>
            </div>

            <div
              className={`rounded-2xl px-3 py-2 text-center ${
                isTimeUp
                  ? "bg-rose-500/90 text-white"
                  : "bg-white/15 text-white"
              }`}
            >
              <div className="text-[9px] font-bold opacity-60">
                {dict.time_label}
              </div>

              <div className="text-sm font-black tabular-nums">
                {remainingSeconds ??
                  elapsedSeconds}
                s
              </div>
            </div>
          </div>
        </div>

        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </header>

      {/* QUESTION CARD */}
      <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl sm:p-7">
        <div className="flex items-center justify-center gap-2 text-xs font-black text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-terracotta-500" />
          {dict.hint_label}
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        </div>

        <h1
          className="mx-auto mt-3 max-w-2xl text-center text-xl font-black leading-relaxed text-teal-900 sm:text-3xl"
          dir={
            hasArabic(
              activeQuestion.question_text,
            )
              ? "rtl"
              : "ltr"
          }
        >
          {activeQuestion.question_text}
        </h1>

        {/* ANSWER BOARD */}
        <div
          className={`mt-7 min-h-24 rounded-3xl border-2 border-dashed p-4 transition sm:p-5 ${
            wrongHint
              ? "border-amber-300 bg-amber-50/70"
              : "border-slate-200 bg-slate-50/80"
          }`}
          dir={answerDir}
        >
          <div className="flex min-h-16 flex-wrap items-center justify-center gap-2">
            {slots.map(
              (slot, index) => (
                <button
                  key={`slot-${index}`}
                  type="button"
                  onClick={() =>
                    removeFromSlot(
                      index,
                    )
                  }
                  disabled={
                    submitting ||
                    feedback !== null ||
                    isTimeUp
                  }
                  aria-label={
                    slot
                      ? `Hapus ${slot.unit}`
                      : `Posisi ${index + 1}`
                  }
                  className={`flex h-14 min-w-11 items-center justify-center rounded-2xl border-2 px-2 text-2xl font-black transition focus:outline-none focus:ring-2 focus:ring-teal-300 sm:h-16 sm:min-w-14 ${
                    slot
                      ? "border-terracotta-300 bg-white text-terracotta-700 shadow-sm"
                      : "border-slate-200 bg-white/60 text-transparent"
                  }`}
                >
                  {slot?.unit ??
                    "·"}
                </button>
              ),
            )}
          </div>
        </div>

        {/* FEEDBACK */}
        <div
          className="mt-4"
          aria-live="polite"
        >
          {feedback ===
          "correct" ? (
            <div className="animate-pulse rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-800">
              ✓ {dict.correct}
            </div>
          ) : null}

          {feedback ===
          "wrong" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-800">
              {fmt(dict.wrong, {
                answer:
                  correctAnswerText,
              })}
            </div>
          ) : null}

          {feedback ===
          "skipped" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
              Jawaban dilewati. Menunggu soal berikutnya…
            </div>
          ) : null}

          {feedback ===
          "error" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-800">
              {saveError}
            </div>
          ) : null}

          {wrongHint &&
          feedback === null &&
          !isTimeUp ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-800">
              {dict.no_letters}
            </div>
          ) : null}

          {isTimeUp &&
          feedback === null ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs font-black text-rose-800">
              ⏰ Waktu habis. Menunggu soal berikutnya…
            </div>
          ) : null}
        </div>

        {/* LETTER TRAY */}
        <div
          className="mt-6 rounded-3xl bg-teal-50/70 p-4 sm:p-5"
          dir={answerDir}
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {tiles.map(
              (tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() =>
                    pickLetter(tile)
                  }
                  disabled={
                    tile.used ||
                    submitting ||
                    feedback !== null ||
                    isTimeUp
                  }
                  aria-label={`Pilih ${tile.unit}`}
                  className={`flex h-14 min-w-11 items-center justify-center rounded-2xl border-2 px-2 text-2xl font-black transition focus:outline-none focus:ring-2 focus:ring-teal-300 active:scale-95 sm:h-16 sm:min-w-14 ${
                    tile.used
                      ? "border-transparent bg-teal-100 text-teal-200"
                      : "border-white bg-white text-teal-800 shadow-md hover:-translate-y-1 hover:border-teal-200"
                  }`}
                >
                  {tile.unit}
                </button>
              ),
            )}
          </div>

          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700/45">
            {dict.shuffled_hint}
          </p>
        </div>

        {/* TIMER BAR */}
        {timerProgress !==
        null ? (
          <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                remainingSeconds !==
                  null &&
                remainingSeconds <=
                  5
                  ? "bg-rose-500"
                  : "bg-teal-500"
              }`}
              style={{
                width: `${timerProgress}%`,
              }}
            />
          </div>
        ) : null}
      </section>

      {/* CONTROLS */}
      <div className="grid grid-cols-[auto_auto_1fr] gap-2 sm:grid-cols-[auto_auto_1fr_1.4fr]">
        <button
          type="button"
          onClick={backspace}
          disabled={
            submitting ||
            feedback !== null ||
            isTimeUp
          }
          className="rounded-2xl border border-white/30 bg-white/90 px-3 py-3 text-sm font-black text-teal-900 shadow-lg transition hover:bg-white disabled:opacity-40 sm:px-5"
        >
          ⌫

          <span className="hidden sm:ms-2 sm:inline">
            {dict.backspace}
          </span>
        </button>

        <button
          type="button"
          onClick={clearAll}
          disabled={
            submitting ||
            feedback !== null ||
            isTimeUp
          }
          className="rounded-2xl border border-white/30 bg-white/90 px-3 py-3 text-sm font-black text-teal-900 shadow-lg transition hover:bg-white disabled:opacity-40 sm:px-5"
        >
          ↺

          <span className="hidden sm:ms-2 sm:inline">
            {dict.clear}
          </span>
        </button>

        <button
          type="button"
          onClick={() => void skip()}
          disabled={
            submitting ||
            feedback !== null ||
            isTimeUp
          }
          className="rounded-2xl border border-amber-200/60 bg-amber-50/95 px-4 py-3 text-sm font-black text-amber-800 shadow-lg transition hover:bg-amber-50 disabled:opacity-40"
        >
          {dict.skip}
        </button>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={
            submitting ||
            feedback !== null ||
            isTimeUp
          }
          className="rounded-2xl bg-terracotta-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-600 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "…"
            : `✓ ${dict.submit}`}
        </button>
      </div>
    </div>
  );
}