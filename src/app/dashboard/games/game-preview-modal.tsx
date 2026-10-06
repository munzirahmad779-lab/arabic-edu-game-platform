"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuestionDifficulty, QuestionOptionKey } from "@/types/database";

type Option = {
  id: string;
  option_key: QuestionOptionKey;
  option_text: string;
  is_correct: boolean;
};

type QuestionItem = {
  id: string;
  position: number;
  question_text: string | null;
  difficulty: QuestionDifficulty | null;
  explanation: string | null;
  options: Option[];
};

const DIFFICULTY_AR: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export function GamePreviewModal({
  gameId,
  gameName,
  gameMode,
  isOpen,
  onClose,
}: {
  gameId: string;
  gameName: string;
  gameMode: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let alive = true;
    setLoading(true);
    setError(null);

    async function loadData() {
      try {
        const supabase = createClient();

        // 1. Fetch game_questions
        const { data: gqData, error: gqErr } = await supabase
          .from("game_questions")
          .select("question_id, position")
          .eq("game_id", gameId)
          .order("position", { ascending: true });

        if (!alive) return;
        if (gqErr) {
          setError("تعذر تحميل أسئلة اللعبة.");
          setLoading(false);
          return;
        }

        if (!gqData || gqData.length === 0) {
          setQuestions([]);
          setLoading(false);
          return;
        }

        const qIds = gqData.map((g) => g.question_id);

        // 2. Fetch questions details
        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .select("id, question_text, difficulty, correct_option_key, explanation")
          .in("id", qIds);

        if (!alive) return;
        if (qErr || !qData) {
          setError("تعذر تحميل نصوص الأسئلة.");
          setLoading(false);
          return;
        }

        // 3. Fetch question_options
        const { data: optData, error: optErr } = await supabase
          .from("question_options")
          .select("id, question_id, option_key, option_text")
          .in("question_id", qIds)
          .order("option_key", { ascending: true });

        if (!alive) return;
        if (optErr) {
          setError("تعذر تحميل الخيارات.");
          setLoading(false);
          return;
        }

        // Map options by question_id
        const qMap = new Map(qData.map((q) => [q.id, q]));
        const optMap = new Map<string, Array<{ id: string; option_key: QuestionOptionKey; option_text: string }>>();
        for (const opt of optData ?? []) {
          const list = optMap.get(opt.question_id) ?? [];
          list.push({
            id: opt.id,
            option_key: opt.option_key,
            option_text: opt.option_text,
          });
          optMap.set(opt.question_id, list);
        }

        const merged: QuestionItem[] = [];
        for (const gq of gqData) {
          const q = qMap.get(gq.question_id);
          if (q) {
            const rawOpts = optMap.get(q.id) ?? [];
            const mappedOpts: Option[] = rawOpts.map((ro) => ({
              ...ro,
              is_correct: q.correct_option_key === ro.option_key,
            }));
            merged.push({
              id: q.id,
              position: gq.position,
              question_text: q.question_text,
              difficulty: q.difficulty,
              explanation: q.explanation,
              options: mappedOpts,
            });
          }
        }

        setQuestions(merged);
      } catch {
        if (alive) setError("حدث خطأ في الاتصال.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadData();

    return () => {
      alive = false;
    };
  }, [gameId, isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/80 px-6 py-4">
          <div>
            <h2 id="preview-title" className="text-lg font-black text-neutral-900">
              👁️ معاينة اللعبة: {gameName}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              الوضع: {gameMode} • إجمالي الأسئلة: {questions.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 transition hover:bg-neutral-300"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-neutral-500">
              جاري تحميل أسئلة اللعبة...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              لا توجد أسئلة مرتبطة بهذه اللعبة.
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-bold text-neutral-900 leading-snug">
                      {q.question_text || "(سؤال بلا نص)"}
                    </h3>
                  </div>
                  {q.difficulty ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        q.difficulty === "easy"
                          ? "bg-emerald-100 text-emerald-800"
                          : q.difficulty === "medium"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {DIFFICULTY_AR[q.difficulty] ?? q.difficulty}
                    </span>
                  ) : null}
                </div>

                {/* Options List */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                        opt.is_correct
                          ? "border-emerald-300 bg-emerald-50/80 font-bold text-emerald-950"
                          : "border-neutral-200 bg-neutral-50/50 text-neutral-700"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-black ${
                          opt.is_correct
                            ? "bg-emerald-600 text-white"
                            : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {opt.option_key.toUpperCase()}
                      </span>
                      <span className="flex-1 truncate">{opt.option_text}</span>
                      {opt.is_correct ? (
                        <span className="text-xs font-bold text-emerald-700">✓ صحيحة</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                {q.explanation ? (
                  <div className="mt-2.5 rounded-xl bg-violet-50/60 p-2.5 text-xs text-violet-900">
                    <span className="font-bold">الشرح: </span>
                    {q.explanation}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-100 bg-neutral-50 px-6 py-3 text-left">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
}
