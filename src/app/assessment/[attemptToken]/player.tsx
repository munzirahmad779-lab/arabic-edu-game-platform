"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Section = {
  id: string;
  section_order: number;
  section_type: string;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  audio_play_once: boolean;
  allow_review: boolean;
};

type Question = {
  id: string;
  section_id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  passage_id: string | null;
  audio_group_id: string | null;
};

type Passage = {
  id: string;
  section_id: string;
  passage_order: number;
  title: string | null;
  content: string;
};

type AudioGroup = {
  id: string;
  section_id: string;
  group_order: number;
  title: string | null;
  audio_url: string | null;
  storage_path: string | null;
};

type Answer = {
  question_id: string;
  selected_answer: string | null;
};

type AttemptSection = {
  section_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  time_spent_seconds: number | null;
};

type Attempt = {
  id: string;
  attempt_token: string;
  assessment_id: string;
  student_name: string;
  status: string;
  started_at: string;
  current_section_order: number;
  current_question_number: number;
};

type Assessment = {
  id: string;
  title: string;
  description: string | null;
};

type QuestionCorrect = {
  id: string;
  section_id: string;
  correct_answer: string;
};

export function AssessmentPlayer({
  attempt,
  assessment,
  sections,
  questions,
  passages,
  audioGroups,
  answers,
  attemptSections,
}: {
  attempt: Attempt;
  assessment: Assessment;
  sections: Section[];
  questions: Question[];
  passages: Passage[];
  audioGroups: AudioGroup[];
  answers: Answer[];
  attemptSections: AttemptSection[];
}) {
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(1);
  const [answerMap, setAnswerMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const a of answers) {
      if (a.selected_answer) map[a.question_id] = a.selected_answer;
    }
    return map;
  });
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassage, setShowPassage] = useState(true);
  const startedAtRef = useRef<number>(Date.now());

  const currentSection = sections[currentSectionIdx];
  const sectionQuestions = useMemo(
    () =>
      questions
        .filter((q) => q.section_id === currentSection?.id)
        .sort((a, b) => a.question_number - b.question_number),
    [questions, currentSection?.id],
  );

  const currentQuestion = sectionQuestions.find(
    (q) => q.question_number === currentQuestionNum,
  );

  const currentPassage = currentQuestion?.passage_id
    ? passages.find((p) => p.id === currentQuestion.passage_id)
    : null;

  const currentAudioGroup = currentQuestion?.audio_group_id
    ? audioGroups.find((a) => a.id === currentQuestion.audio_group_id)
    : null;

  useEffect(() => {
    if (!currentSection) return;
    const duration = currentSection.duration_minutes * 60;
    const attemptSec = attemptSections.find(
      (s) => s.section_id === currentSection.id,
    );
    const sectionStart = attemptSec?.started_at
      ? new Date(attemptSec.started_at).getTime()
      : Date.now();
    startedAtRef.current = sectionStart;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - sectionStart) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) {
        void autoNextSection();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionIdx, currentSection?.id]);

  async function saveAnswer(questionId: string, answer: string) {
    setAnswerMap((prev) => ({ ...prev, [questionId]: answer }));
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      await db.from("assessment_answers").upsert(
        {
          attempt_id: attempt.id,
          question_id: questionId,
          selected_answer: answer,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "attempt_id,question_id" },
      );
    } catch {
      // silent
    }
  }

  async function finishSection() {
    if (!currentSection) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const duration = currentSection.duration_minutes * 60;
    const elapsed = Math.min(
      duration,
      Math.floor((Date.now() - startedAtRef.current) / 1000),
    );

    await db
      .from("assessment_attempt_sections")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        time_spent_seconds: elapsed,
      })
      .eq("attempt_id", attempt.id)
      .eq("section_id", currentSection.id);

    const nextIdx = currentSectionIdx + 1;
    if (nextIdx < sections.length) {
      await db
        .from("assessment_attempt_sections")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("attempt_id", attempt.id)
        .eq("section_id", sections[nextIdx].id);

      await db
        .from("assessment_attempts")
        .update({ current_section_order: nextIdx + 1 })
        .eq("id", attempt.id);

      setCurrentSectionIdx(nextIdx);
      setCurrentQuestionNum(1);
      setTimeLeft(sections[nextIdx].duration_minutes * 60);
    } else {
      await finishAttempt();
    }
  }

  async function autoNextSection() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await finishSection();
    } finally {
      setSubmitting(false);
    }
  }

  async function finishAttempt() {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: allQuestions } = await db
      .from("assessment_questions")
      .select("id, section_id, correct_answer")
      .eq("assessment_id", attempt.assessment_id);

    const correctMap: Record<string, string> = {};
    const qSection: Record<string, string> = {};
    for (const q of (allQuestions ?? []) as QuestionCorrect[]) {
      correctMap[q.id] = q.correct_answer;
      qSection[q.id] = q.section_id;
    }

    const rawBySection: Record<string, number> = {};
    for (const [qid, ans] of Object.entries(answerMap)) {
      const correct = correctMap[qid];
      const isCorrect = correct === ans;
      const sid = qSection[qid];
      if (!sid) continue;
      if (!rawBySection[sid]) rawBySection[sid] = 0;
      if (isCorrect) rawBySection[sid] += 1;

      await db
        .from("assessment_answers")
        .update({ is_correct: isCorrect })
        .eq("attempt_id", attempt.id)
        .eq("question_id", qid);
    }

    const sectionTypeMap: Record<string, string> = {};
    for (const s of sections) sectionTypeMap[s.id] = s.section_type;

    let scaledL = 31;
    let scaledS = 31;
    let scaledR = 31;
    for (const [sid, raw] of Object.entries(rawBySection)) {
      const type = sectionTypeMap[sid];
      const { data: scaled } = await db.rpc("assessment_convert_section", {
        p_section_type: type,
        p_raw: raw,
      });
      const val = typeof scaled === "number" ? scaled : 31;
      if (type === "listening") scaledL = val;
      else if (type === "structure") scaledS = val;
      else if (type === "reading") scaledR = val;
    }

    const total = Math.round(((scaledL + scaledS + scaledR) / 3) * 10);

    await db
      .from("assessment_attempts")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        raw_listening:
          rawBySection[
            sections.find((s) => s.section_type === "listening")?.id ?? ""
          ] ?? 0,
        raw_structure:
          rawBySection[
            sections.find((s) => s.section_type === "structure")?.id ?? ""
          ] ?? 0,
        raw_reading:
          rawBySection[
            sections.find((s) => s.section_type === "reading")?.id ?? ""
          ] ?? 0,
        score_listening: scaledL,
        score_structure: scaledS,
        score_reading: scaledR,
        score_total: total,
      })
      .eq("id", attempt.id);

    window.location.href = `/assessment/${attempt.attempt_token}/result`;
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (!currentSection || !currentQuestion) {
    return (
      <div className="min-h-screen bg-warmwhite p-6">
        <p className="text-center text-softslate">Memuat ujian...</p>
      </div>
    );
  }

  const answeredCount = Object.keys(answerMap).length;
  const totalQuestions = questions.length;

  return (
    <div className="min-h-screen bg-warmwhite">
      <header className="sticky top-0 z-30 border-b border-sage-200/60 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-terracotta-500">
              {attempt.student_name}
            </p>
            <h1 className="font-display text-lg font-black text-teal-700">
              {assessment.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs">
              <span className="font-bold text-teal-700">
                Section {currentSectionIdx + 1}/{sections.length}
              </span>
            </div>
            <div className="rounded-xl bg-terracotta-50 px-3 py-1.5 text-xs">
              <span className="font-bold text-terracotta-600">
                Soal {currentQuestionNum}/{sectionQuestions.length}
              </span>
            </div>
            <div
              className={`rounded-xl px-4 py-1.5 text-sm font-mono font-black tabular-nums ${
                (timeLeft ?? 0) <= 60
                  ? "animate-pulse bg-red-100 text-red-700"
                  : "bg-sage-100 text-sage-600"
              }`}
              dir="ltr"
            >
              ⏱ {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <main className="space-y-4">
            <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
                {currentSection.section_type}
              </p>
              <h2 className="font-display mt-1 text-xl font-black text-teal-700">
                {currentSection.title}
              </h2>
              {currentSection.instructions ? (
                <p className="mt-2 text-sm text-softslate/80">
                  {currentSection.instructions}
                </p>
              ) : null}
            </div>

            {currentAudioGroup ? (
              <div className="rounded-2xl border-2 border-terracotta-500/30 bg-terracotta-50 p-4">
                <p className="text-xs font-black text-terracotta-600">
                  🎧 {currentAudioGroup.title ?? "Audio"}
                  {currentSection.audio_play_once
                    ? " — diputar sekali, tidak bisa diulang"
                    : ""}
                </p>
                {currentAudioGroup.audio_url ? (
                  <audio
                    src={currentAudioGroup.audio_url}
                    controls
                    controlsList={
                      currentSection.audio_play_once
                        ? "nodownload noplaybackrate noremoteplayback"
                        : undefined
                    }
                    className="mt-2 w-full"
                  />
                ) : (
                  <p className="mt-2 text-xs text-terracotta-600">
                    Audio belum di-upload guru.
                  </p>
                )}
              </div>
            ) : null}

            {currentPassage ? (
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setShowPassage((v) => !v)}
                  className="mb-2 flex w-full items-center justify-between text-xs font-black text-teal-700"
                >
                  <span>📖 {currentPassage.title ?? "Bacaan"}</span>
                  <span>{showPassage ? "−" : "+"}</span>
                </button>
                {showPassage ? (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-softslate">
                    {currentPassage.content}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="aesthetic-card">
              <p className="text-sm font-black text-teal-700">
                Soal {currentQuestionNum}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-base font-medium leading-8 text-teal-700">
                {currentQuestion.question_text}
              </p>

              <div className="mt-4 space-y-2">
                {(
                  [
                    ["A", currentQuestion.option_a],
                    ["B", currentQuestion.option_b],
                    ["C", currentQuestion.option_c],
                    ["D", currentQuestion.option_d],
                  ] as const
                ).map(([key, text]) => {
                  const selected = answerMap[currentQuestion.id] === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => saveAnswer(currentQuestion.id, key)}
                      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-start transition ${
                        selected
                          ? "border-terracotta-500 bg-terracotta-50"
                          : "border-sage-200 bg-white hover:border-terracotta-500/50 hover:bg-terracotta-50/50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black ${
                          selected
                            ? "bg-terracotta-500 text-white"
                            : "bg-sage-100 text-teal-700"
                        }`}
                      >
                        {key}
                      </span>
                      <span className="text-sm font-medium leading-7 text-softslate">
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentQuestionNum((n) => Math.max(1, n - 1))
                }
                disabled={currentQuestionNum <= 1}
                className="rounded-full border border-sage-200 bg-white px-5 py-2.5 text-sm font-black text-teal-700 transition hover:bg-sage-50 disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              {currentQuestionNum < sectionQuestions.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionNum((n) => n + 1)}
                  className="rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void finishSection()}
                  disabled={submitting}
                  className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-60"
                >
                  {submitting
                    ? "..."
                    : currentSectionIdx + 1 < sections.length
                      ? "Selesai Section → Next"
                      : "Selesai & Lihat Hasil"}
                </button>
              )}
            </div>
          </main>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
              <p className="text-xs font-black text-teal-700">Navigasi Soal</p>
              <p className="mt-1 text-[10px] text-softslate/70">
                {answeredCount} dari {totalQuestions} terjawab
              </p>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {sectionQuestions.map((q) => {
                  const answered = Boolean(answerMap[q.id]);
                  const isCurrent = q.question_number === currentQuestionNum;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQuestionNum(q.question_number)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition ${
                        isCurrent
                          ? "bg-teal-700 text-white"
                          : answered
                            ? "bg-terracotta-500 text-white"
                            : "bg-sage-100 text-teal-700 hover:bg-sage-200"
                      }`}
                    >
                      {q.question_number}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-xs">
              <p className="font-black text-teal-700">Sections</p>
              <ul className="mt-2 space-y-1">
                {sections.map((s, idx) => (
                  <li
                    key={s.id}
                    className={`rounded-lg px-2 py-1 ${
                      idx === currentSectionIdx
                        ? "bg-teal-50 font-black text-teal-700"
                        : idx < currentSectionIdx
                          ? "text-sage-600"
                          : "text-softslate/50"
                    }`}
                  >
                    {idx + 1}. {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}