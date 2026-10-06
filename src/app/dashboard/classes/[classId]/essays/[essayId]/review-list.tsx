"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

type Submission = {
  submission_id: string;
  student_id: string;
  student_name: string;
  answer_text: string;
  duration_seconds: number | null;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_scores_json: {
    content: number;
    grammar: number;
    vocabulary: number;
  } | null;
  teacher_override_score: number | null;
  teacher_override_feedback: string | null;
  submitted_at: string;
};

type ReviewDict = {
  empty_title: string;
  empty_desc: string;
  err_range: string;
  err_prefix: string;
  err_conn: string;
  edited_badge: string;
  initial_grade: string;
  student_answer_title: string;
  duration_prefix: string;
  minutes_suffix: string;
  subscore_content: string;
  subscore_grammar: string;
  subscore_vocab: string;
  ai_feedback_title: string;
  teacher_feedback_title: string;
  final_score_label: string;
  teacher_feedback_label: string;
  save_btn: string;
  cancel_btn: string;
  saving: string;
  edit_grade_btn: string;
};

const DICT_LOADERS: Record<
  Locale,
  () => Promise<{ review_list: ReviewDict }>
> = {
  id: () =>
    import("@/lib/i18n/id.json").then(
      (m) => m.default as unknown as { review_list: ReviewDict },
    ),
  en: () =>
    import("@/lib/i18n/en.json").then(
      (m) => m.default as unknown as { review_list: ReviewDict },
    ),
  ar: () =>
    import("@/lib/i18n/ar.json").then(
      (m) => m.default as unknown as { review_list: ReviewDict },
    ),
};

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const v = m ? decodeURIComponent(m[1]) : DEFAULT_LOCALE;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export function ReviewList({ submissions }: { submissions: Submission[] }) {
  const [rl, setRl] = useState<ReviewDict | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = await DICT_LOADERS[readLocale()]();
        if (alive) setRl(mod.review_list);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!rl) return null;

  if (submissions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <div className="text-4xl">📭</div>
        <p className="mt-3 text-sm font-bold text-neutral-700">
          {rl.empty_title}
        </p>
        <p className="mt-1 text-xs text-neutral-500">{rl.empty_desc}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {submissions.map((s) => (
        <SubmissionCard key={s.submission_id} sub={s} rl={rl} />
      ))}
    </section>
  );
}

function SubmissionCard({ sub, rl }: { sub: Submission; rl: ReviewDict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(String(sub.teacher_override_score ?? ""));
  const [feedback, setFeedback] = useState(sub.teacher_override_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(sub);

  async function saveOverride() {
    const numScore = Number(score);
    if (!Number.isFinite(numScore) || numScore < 0 || numScore > 100) {
      alert(rl.err_range);
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("essay_submissions")
        .update({
          teacher_override_score: Math.round(numScore),
          teacher_override_feedback: feedback.trim() || null,
          teacher_graded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.submission_id);

      if (error) {
        alert(`${rl.err_prefix}${error.message}`);
      } else {
        setCurrent((prev) => ({
          ...prev,
          teacher_override_score: Math.round(numScore),
          teacher_override_feedback: feedback.trim() || null,
        }));
        setEditing(false);
      }
    } catch {
      alert(rl.err_conn);
    } finally {
      setSaving(false);
    }
  }

  const finalScore =
    current.teacher_override_score ?? current.ai_score ?? 0;
  const hasOverride = current.teacher_override_score !== null;

  const subscores = current.ai_scores_json ?? {
    content: 0,
    grammar: 0,
    vocabulary: 0,
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-start transition hover:bg-neutral-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white">
            {current.student_name.charAt(0) || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-neutral-900">
              {current.student_name}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {hasOverride ? rl.edited_badge : rl.initial_grade} —{" "}
              <span className="font-black">{finalScore}/100</span>
            </p>
          </div>
        </div>
        <span className="text-2xl text-neutral-400">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-neutral-100 p-4">
          <div>
            <h4 className="text-xs font-black text-neutral-700">
              {rl.student_answer_title}
            </h4>
            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm leading-7 text-neutral-800">
              {current.answer_text}
            </div>
            {current.duration_seconds !== null ? (
              <p className="mt-1 text-xs text-neutral-500">
                {rl.duration_prefix}
                {Math.floor(current.duration_seconds / 60)}{" "}
                {rl.minutes_suffix}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-violet-50 p-2 text-center">
              <div className="text-[10px] font-bold text-violet-700">
                {rl.subscore_content}
              </div>
              <div className="text-lg font-black text-violet-900">
                {subscores.content}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-center">
              <div className="text-[10px] font-bold text-amber-700">
                {rl.subscore_grammar}
              </div>
              <div className="text-lg font-black text-amber-900">
                {subscores.grammar}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-center">
              <div className="text-[10px] font-bold text-emerald-700">
                {rl.subscore_vocab}
              </div>
              <div className="text-lg font-black text-emerald-900">
                {subscores.vocabulary}
              </div>
            </div>
          </div>

          {current.ai_feedback ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
              <p className="text-xs font-black text-violet-800">
                {rl.ai_feedback_title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-violet-950">
                {current.ai_feedback}
              </p>
            </div>
          ) : null}

          {current.teacher_override_feedback ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs font-black text-amber-800">
                {rl.teacher_feedback_title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-amber-950">
                {current.teacher_override_feedback}
              </p>
            </div>
          ) : null}

          {editing ? (
            <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700">
                  {rl.final_score_label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700">
                  {rl.teacher_feedback_label}
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveOverride()}
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? rl.saving : rl.save_btn}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
                >
                  {rl.cancel_btn}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-700 transition hover:bg-violet-100"
            >
              {rl.edit_grade_btn}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}