"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  pauseBackgroundAudio,
  resumeBackgroundAudio,
} from "@/lib/bg-audio-events";
import { Confetti } from "@/components/confetti";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;
type Locale = "id" | "en" | "ar";

type MediaItem = {
  id: string;
  media_type: "image" | "audio" | "video" | string;
  storage_path: string | null;
  mime_type: string | null;
  max_play_count: number | null;
};

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
  media: MediaItem[];
};

type GameData = {
  game_id: string;
  game_name: string;
  game_mode: string;
  questions: Question[];
};

type ProgressRow = {
  question_id: string;
  selected_option_key: string;
  is_correct: boolean;
  answered_at: string;
  correct_option_key: string;
  explanation: string | null;
};

type AnswerState = {
  selected: string;
  isCorrect: boolean;
  correct: string;
  explanation: string | null;
};

type RpcClient = {
  rpc<TResult>(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: TResult[] | null;
    error: { message: string } | null;
  }>;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PracticePlayer({
  token,
  game,
  initialProgress,
  studentName,
  className,
  dict,
  locale,
}: {
  token: string;
  game: GameData;
  initialProgress: ProgressRow[];
  studentName: string;
  className: string;
  dict: Dict;
  locale: Locale;
}) {
  const t = dict.student;
  const isRtl = locale === "ar";

  const MODE_LABEL: Record<string, string> = {
    endless: t.mode_endless,
    practice: t.mode_practice,
  };

  const DIFFICULTY_LABEL: Record<string, string> = {
    easy: locale === "ar" ? "سهل" : locale === "en" ? "Easy" : "Mudah",
    medium: locale === "ar" ? "متوسط" : locale === "en" ? "Medium" : "Sedang",
    hard: locale === "ar" ? "صعب" : locale === "en" ? "Hard" : "Sulit",
  };

  const [questions] = useState<Question[]>(() => shuffle(game.questions));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const map: Record<string, AnswerState> = {};
    for (const p of initialProgress) {
      map[p.question_id] = {
        selected: p.selected_option_key,
        isCorrect: p.is_correct,
        correct: p.correct_option_key,
        explanation: p.explanation,
      };
    }
    return map;
  });
  const [revealedExplanation, setRevealedExplanation] = useState<
    Record<string, boolean>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showScore, setShowScore] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [resetting, setResetting] = useState(false);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const currentQuestion = questions[currentIndex];

  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const mediaUrl = useMemo(() => {
    const supabase = createClient();
    return (path: string) =>
      supabase.storage.from("question-media").getPublicUrl(path).data
        .publicUrl;
  }, []);

  useEffect(() => {
    if (initialProgress.length >= totalQuestions && totalQuestions > 0) {
      setShowScore(true);
    }
  }, [initialProgress.length, totalQuestions]);

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const currentExplanationShown = currentQuestion
    ? revealedExplanation[currentQuestion.id]
    : false;

  async function submitAnswer(optionKey: string) {
    if (!currentQuestion || submitting || currentAnswer) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const supabase = createClient() as unknown as RpcClient;
      const { data, error } = await supabase.rpc<{
        accepted: boolean;
        is_correct: boolean;
        correct_option_key: string;
        explanation: string | null;
      }>("student_submit_practice_answer", {
        p_token: token,
        p_game_id: game.game_id,
        p_question_id: currentQuestion.id,
        p_selected_option_key: optionKey,
      });

      if (error || !data || !data[0]) {
        setSubmitError(t.player_submit_error);
        return;
      }

      const result = data[0];

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          selected: optionKey,
          isCorrect: result.is_correct,
          correct: result.correct_option_key,
          explanation: result.explanation,
        },
      }));

      setTimeout(() => {
        document
          .getElementById("practice-feedback")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch {
      setSubmitError(t.player_connection_error);
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setShowScore(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function resetPractice() {
    if (resetting) return;
    if (!window.confirm(t.player_confirm_reset)) return;

    setResetting(true);

    try {
      const supabase = createClient() as unknown as RpcClient;
      await supabase.rpc("student_reset_practice", {
        p_token: token,
        p_game_id: game.game_id,
      });

      setAnswers({});
      setRevealedExplanation({});
      setCurrentIndex(0);
      setShowScore(false);
      setShowReview(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore
    } finally {
      setResetting(false);
    }
  }

  function toggleExplanation(questionId: string) {
    setRevealedExplanation((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  if (showScore) {
    const percent =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;
    const showConfetti = percent >= 70;

    const medal =
      percent >= 90 ? "🏆" : percent >= 70 ? "🥈" : percent >= 50 ? "🥉" : "📚";
    const message =
      percent >= 90
        ? t.player_score_high
        : percent >= 70
          ? t.player_score_good
          : percent >= 50
            ? t.player_score_ok
            : t.player_score_low;

    return (
      <main
        className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-4 sm:p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {showConfetti ? (
          <Confetti particleCount={140} originY={0.9} />
        ) : null}
        <div className="relative mx-auto max-w-3xl space-y-6">
          <nav>
            <Link
              href="/student/practice"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
            >
              <span>→</span>
              <span>{t.player_back_practices}</span>
            </Link>
          </nav>

          <section className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
            <div className="text-6xl">{medal}</div>
            <h1 className="mt-4 text-3xl font-black text-neutral-900">
              {message}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">{game.game_name}</p>

            <div className="mt-8 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-black tabular-nums text-emerald-700">
                  {correctCount}
                </div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  {t.player_correct_label}
                </div>
              </div>
              <div className="h-16 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-5xl font-black tabular-nums text-neutral-400">
                  {totalQuestions}
                </div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  {t.player_total_label}
                </div>
              </div>
              <div className="h-16 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-5xl font-black tabular-nums text-violet-700">
                  {percent}%
                </div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  {t.player_percent_label}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowReview((v) => !v)}
              className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
            >
              {showReview ? t.player_review_hide : t.player_review_show}
            </button>
            <button
              type="button"
              onClick={() => void resetPractice()}
              disabled={resetting}
              className="rounded-2xl border-2 border-violet-200 bg-white px-5 py-4 text-base font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50 disabled:opacity-60"
            >
              {resetting ? t.player_reset_loading : t.player_reset}
            </button>
          </div>

          {showReview ? (
            <section className="space-y-4">
              <h2 className="text-lg font-black text-neutral-900">
                {t.player_review_title}
              </h2>
              {questions.map((q, idx) => {
                const a = answers[q.id];
                const correct = a?.isCorrect === true;
                const explanationShown = revealedExplanation[q.id];

                return (
                  <article
                    key={q.id}
                    className={`rounded-2xl border-2 bg-white p-5 shadow-sm ${
                      correct ? "border-emerald-200" : "border-rose-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                        {t.player_question_prefix} {idx + 1}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          correct
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {correct ? t.player_correct : t.player_wrong}
                      </span>
                    </div>

                    <p className="mt-3 text-base font-bold leading-8 text-neutral-900">
                      {q.question_text}
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt) => {
                        const isSelected = a?.selected === opt.option_key;
                        const isCorrectOpt = a?.correct === opt.option_key;
                        const highlight = isCorrectOpt
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : isSelected
                            ? "border-rose-300 bg-rose-50 text-rose-900"
                            : "border-neutral-200 bg-white text-neutral-700";

                        return (
                          <div
                            key={opt.id}
                            className={`rounded-xl border-2 p-3 text-sm ${highlight}`}
                          >
                            <span className="font-black">
                              {opt.option_key}.
                            </span>{" "}
                            {opt.option_text}
                            {isCorrectOpt ? (
                              <span className="ms-2 text-xs font-bold">
                                {t.player_correct_answer_mark}
                              </span>
                            ) : null}
                            {isSelected && !isCorrectOpt ? (
                              <span className="ms-2 text-xs font-bold">
                                {t.player_your_answer_mark}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {a ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleExplanation(q.id)}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100"
                        >
                          {explanationShown
                            ? t.player_why_hide
                            : t.player_why_show}
                        </button>

                        {explanationShown ? (
                          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm leading-7 text-violet-950">
                            {a.explanation && a.explanation.trim().length > 0
                              ? a.explanation
                              : t.player_no_explanation}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main
        className="min-h-screen bg-slate-50 p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-neutral-600">{t.player_no_questions}</p>
          <Link
            href="/student/practice"
            className="mt-4 inline-flex rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white"
          >
            {t.player_back}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4 py-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-violet-600">
                {className} — {studentName}
              </p>
              <h1 className="mt-1 text-xl font-black text-neutral-900">
                {game.game_name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {MODE_LABEL[game.game_mode] ?? game.game_mode}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
                  {t.player_no_time}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-2 text-center">
              <div className="text-xs font-bold text-violet-600">
                {t.player_question_label}
              </div>
              <div className="text-lg font-black text-violet-900">
                {currentIndex + 1} / {totalQuestions}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
              <span>
                {answeredCount} {t.player_progress_of} {totalQuestions}{" "}
                {t.player_progress_done}
              </span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
              {DIFFICULTY_LABEL[currentQuestion.difficulty] ??
                currentQuestion.difficulty}
            </span>
            {currentAnswer ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  currentAnswer.isCorrect
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {currentAnswer.isCorrect ? t.player_correct : t.player_wrong}
              </span>
            ) : null}
          </div>

          {currentQuestion.media.length > 0 ? (
            <div className="mt-5 space-y-4">
              {currentQuestion.media.map((m) => {
                if (!m.storage_path) return null;
                const url = mediaUrl(m.storage_path);

                if (m.media_type === "image") {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={url}
                      alt=""
                      className="mx-auto max-h-72 rounded-2xl border-2 border-slate-200 object-contain"
                    />
                  );
                }
                if (m.media_type === "audio") {
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-center text-xs font-bold text-violet-600">
                        {t.player_listen}
                      </p>
                      <audio
                        src={url}
                        controls
                        controlsList={
                          m.max_play_count === 1
                            ? "nodownload noplaybackrate"
                            : undefined
                        }
                        onPlay={() => pauseBackgroundAudio()}
                        onEnded={() => resumeBackgroundAudio()}
                        className="mx-auto w-full max-w-md"
                      />
                    </div>
                  );
                }
                if (m.media_type === "video") {
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-center text-xs font-bold text-violet-600">
                        {t.player_watch}
                      </p>
                      <video
                        src={url}
                        controls
                        controlsList={
                          m.max_play_count === 1
                            ? "nodownload noplaybackrate"
                            : undefined
                        }
                        onPlay={() => pauseBackgroundAudio()}
                        onEnded={() => resumeBackgroundAudio()}
                        className="mx-auto max-h-72 w-full rounded-2xl border-2 border-slate-200"
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : null}

          <h2 className="mt-6 text-center text-2xl font-black leading-relaxed text-neutral-900 sm:text-3xl">
            {currentQuestion.question_text}
          </h2>

          <div className="mt-6 grid gap-3">
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer?.selected === option.option_key;
              const isCorrectOpt =
                currentAnswer?.correct === option.option_key && currentAnswer;

              let cls =
                "rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-start text-base font-bold text-neutral-800 shadow-sm transition";

              if (!currentAnswer) {
                cls +=
                  " hover:border-violet-400 hover:bg-violet-50 disabled:opacity-60";
              } else {
                if (isCorrectOpt) {
                  cls =
                    "rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-5 py-4 text-start text-base font-bold text-emerald-900 shadow-sm";
                } else if (isSelected) {
                  cls =
                    "rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-4 text-start text-base font-bold text-rose-900 shadow-sm";
                } else {
                  cls += " opacity-60";
                }
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={submitting || Boolean(currentAnswer)}
                  onClick={() => void submitAnswer(option.option_key)}
                  className={cls}
                >
                  <span className="me-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700 text-sm font-black text-white">
                    {option.option_key}
                  </span>
                  {option.option_text}
                  {currentAnswer && isCorrectOpt ? (
                    <span className="ms-2 text-xs font-black">
                      {t.player_correct_answer_mark}
                    </span>
                  ) : null}
                  {currentAnswer && isSelected && !isCorrectOpt ? (
                    <span className="ms-2 text-xs font-black">
                      {t.player_your_answer_mark}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {submitError ? (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-center text-sm font-bold text-rose-700">
              {submitError}
            </div>
          ) : null}

          {currentAnswer ? (
            <div id="practice-feedback" className="mt-6 space-y-3">
              <div
                className={`rounded-2xl p-4 text-center text-sm font-black ${
                  currentAnswer.isCorrect
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
              >
                {currentAnswer.isCorrect
                  ? t.player_feedback_correct
                  : `${t.player_feedback_wrong_prefix} ${currentAnswer.correct}`}
              </div>

              <button
                type="button"
                onClick={() => toggleExplanation(currentQuestion.id)}
                className="w-full rounded-2xl border-2 border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-800 transition hover:bg-violet-100"
              >
                {currentExplanationShown
                  ? t.player_why_hide
                  : t.player_why_show}
              </button>

              {currentExplanationShown ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-sm leading-7 text-violet-950">
                  {currentAnswer.explanation &&
                  currentAnswer.explanation.trim().length > 0
                    ? currentAnswer.explanation
                    : t.player_no_explanation}
                </div>
              ) : null}

              <button
                type="button"
                onClick={goNext}
                className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
              >
                {currentIndex + 1 < totalQuestions
                  ? t.player_next
                  : t.player_show_score}
              </button>
            </div>
          ) : null}
        </section>

        {!currentAnswer ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-center text-xs font-bold text-neutral-500">
              {t.player_choose_hint}
            </p>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {questions.map((q, i) => {
                const a = answers[q.id];
                const cls = a
                  ? a.isCorrect
                    ? "bg-emerald-500 text-white"
                    : "bg-rose-500 text-white"
                  : i === currentIndex
                    ? "bg-violet-600 text-white ring-2 ring-violet-300"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200";

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={`h-8 w-8 rounded-lg text-xs font-black transition ${cls}`}
                    title={`${t.player_question_prefix} ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            {answeredCount === totalQuestions ? (
              <button
                type="button"
                onClick={() => setShowScore(true)}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
              >
                {t.player_show_final}
              </button>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}