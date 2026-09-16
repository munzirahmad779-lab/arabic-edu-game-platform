"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EssayData = {
  id: string;
  title: string;
  question_text: string;
  duration_minutes: number;
  my_answer: string | null;
  my_score: number | null;
  my_feedback: string | null;
  my_scores_json: {
    content: number;
    grammar: number;
    vocabulary: number;
  } | null;
  submitted_at: string | null;
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

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EssayPlayer({
  token,
  essay,
  studentName,
  className,
}: {
  token: string;
  essay: EssayData;
  studentName: string;
  className: string;
}) {
  const alreadySubmitted = Boolean(essay.my_answer);

  const [phase, setPhase] = useState<"intro" | "writing" | "grading" | "result">(
    alreadySubmitted ? "result" : "intro",
  );
  const [answer, setAnswer] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(essay.duration_minutes * 60);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
    subscores: { content: number; grammar: number; vocabulary: number };
  } | null>(
    alreadySubmitted && essay.my_score !== null
      ? {
          score: essay.my_score,
          feedback: essay.my_feedback ?? "",
          subscores:
            essay.my_scores_json ?? {
              content: 0,
              grammar: 0,
              vocabulary: 0,
            },
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  // Timer
  useEffect(() => {
    if (phase !== "writing" || startedAt === null) return;

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const left = essay.duration_minutes * 60 - elapsed;
      setSecondsLeft(Math.max(0, left));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, startedAt, essay.duration_minutes]);

  // Auto submit waktu habis
  useEffect(() => {
    if (
      phase === "writing" &&
      secondsLeft === 0 &&
      !autoSubmittedRef.current &&
      !submitting
    ) {
      autoSubmittedRef.current = true;
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  async function handleSubmit(auto = false) {
    if (submitting) return;

    const cleanAnswer = answer.trim();
    if (!auto && cleanAnswer.length < 10) {
      setError("الإجابة قصيرة جدًا (10 أحرف على الأقل).");
      return;
    }

    if (cleanAnswer.length < 10 && auto) {
      setError("انتهى الوقت — لم يتم تسليم أي إجابة.");
      setPhase("intro");
      return;
    }

    setSubmitting(true);
    setError(null);

    const durationSeconds =
      startedAt !== null ? Math.floor((Date.now() - startedAt) / 1000) : 0;

    try {
      const supabase = createClient() as unknown as RpcClient;
      const { data, error: subErr } = await supabase.rpc<string>(
        "student_submit_essay",
        {
          p_token: token,
          p_essay_id: essay.id,
          p_answer_text: cleanAnswer,
          p_duration_seconds: durationSeconds,
        },
      );

      if (subErr || !data || !data[0]) {
        setError("تعذر تسليم الإجابة. حاول مرة أخرى.");
        return;
      }

      const submissionId = data[0];

      // Panggil AI grading
      setPhase("grading");

      const res = await fetch("/api/grade-essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });

      const json = (await res.json()) as {
        ok: boolean;
        score?: number;
        feedback?: string;
        subscores?: { content: number; grammar: number; vocabulary: number };
        message?: string;
      };

      if (!json.ok) {
        setError(
          `تم التسليم، لكن فشل التقييم التلقائي: ${json.message ?? "خطأ"}. سيقوم المعلم بتقييمها يدويًا.`,
        );
        setPhase("result");
        setResult({ score: 0, feedback: "لم يتم التقييم بعد.", subscores: { content: 0, grammar: 0, vocabulary: 0 } });
        return;
      }

      setResult({
        score: json.score ?? 0,
        feedback: json.feedback ?? "",
        subscores: json.subscores ?? { content: 0, grammar: 0, vocabulary: 0 },
      });
      setPhase("result");
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  // ============ INTRO ============
  if (phase === "intro") {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 py-8 sm:p-6"
        dir="rtl"
      >
        <div className="mx-auto max-w-2xl space-y-5">
          <nav>
            <Link
              href="/student/essay"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
            >
              <span>→</span>
              <span>رجوع إلى المهام</span>
            </Link>
          </nav>

          <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl sm:p-8">
            <p className="text-xs font-bold text-white/75">
              {className} — {studentName}
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              ✍️ {essay.title}
            </h1>
          </header>

          <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg sm:p-8">
            <h2 className="text-sm font-black text-violet-700">السؤال</h2>
            <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-neutral-800">
              {essay.question_text}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-amber-50 p-4 text-center">
                <div className="text-xs font-bold text-amber-700">
                  المدة المخصصة
                </div>
                <div className="mt-1 text-2xl font-black text-amber-900">
                  {essay.duration_minutes} دقيقة
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                <div className="text-xs font-bold text-emerald-700">
                  التقييم
                </div>
                <div className="mt-1 text-sm font-black text-emerald-900">
                  تلقائي بالذكاء الاصطناعي
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              <p className="font-black">⚠️ تنبيهات</p>
              <ul className="mt-2 list-disc space-y-1 pr-5">
                <li>سيبدأ العد عند الضغط على «ابدأ الكتابة».</li>
                <li>سيتم التسليم تلقائيًا عند انتهاء الوقت.</li>
                <li>لديك تسليم واحد فقط — لا يمكن التعديل بعد التسليم.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => {
                setStartedAt(Date.now());
                setSecondsLeft(essay.duration_minutes * 60);
                setPhase("writing");
              }}
              className="mt-6 w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
            >
              ✏️ ابدأ الكتابة
            </button>
          </section>
        </div>
      </main>
    );
  }

  // ============ WRITING ============
  if (phase === "writing") {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 py-6 sm:p-6"
        dir="rtl"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-lg">
            <div>
              <p className="text-xs font-bold text-violet-600">مهمة كتابة</p>
              <h1 className="mt-0.5 text-lg font-black text-neutral-900">
                {essay.title}
              </h1>
            </div>
            <div
              className={`rounded-2xl px-4 py-2 text-center transition ${
                secondsLeft <= 60
                  ? "animate-pulse bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <div className="text-xs font-bold">الوقت المتبقي</div>
              <div className="text-xl font-black tabular-nums" dir="ltr">
                {formatTime(secondsLeft)}
              </div>
            </div>
          </header>

          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-black text-violet-700">السؤال</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-800">
              {essay.question_text}
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <label
              htmlFor="essay-answer"
              className="block text-sm font-black text-neutral-800"
            >
              إجابتك
            </label>
            <textarea
              id="essay-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={14}
              maxLength={20000}
              placeholder="اكتب إجابتك هنا..."
              className="mt-3 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm leading-8 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{answer.trim().length} حرف</span>
              <span>الحد الأقصى 20000</span>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={submitting || answer.trim().length < 10}
              className="mt-4 w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "..." : "✓ تسليم الإجابة"}
            </button>
          </section>
        </div>
      </main>
    );
  }

  // ============ GRADING ============
  if (phase === "grading") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6"
        dir="rtl"
      >
        <div className="w-full max-w-md rounded-[2rem] bg-white p-10 text-center shadow-2xl">
          <div className="text-6xl">🤖</div>
          <h1 className="mt-5 text-2xl font-black text-neutral-900">
            جاري التقييم...
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            يقوم الذكاء الاصطناعي بتقييم إجابتك. قد يستغرق 5-15 ثانية.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full w-full animate-pulse bg-gradient-to-l from-violet-600 to-fuchsia-600" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============ RESULT ============
  const s = result?.subscores ?? { content: 0, grammar: 0, vocabulary: 0 };
  const scoreColor =
    (result?.score ?? 0) >= 80
      ? "text-emerald-700"
      : (result?.score ?? 0) >= 60
        ? "text-amber-700"
        : "text-rose-700";

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 py-8 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <nav>
          <Link
            href="/student/essay"
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>رجوع إلى المهام</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-bold text-white/75">
            {className} — {studentName}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            ✅ تم التسليم
          </h1>
          <p className="mt-2 text-sm text-white/85">{essay.title}</p>
        </header>

        {result ? (
          <section className="rounded-[2rem] bg-white p-8 text-center shadow-lg">
            <p className="text-xs font-bold text-neutral-500">نتيجتك</p>
            <div className={`mt-2 text-6xl font-black tabular-nums ${scoreColor}`}>
              {result.score}
            </div>
            <p className="mt-1 text-xs font-bold text-neutral-500">من 100</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-violet-50 p-3">
                <div className="text-[10px] font-bold text-violet-700">
                  المحتوى
                </div>
                <div className="mt-0.5 text-lg font-black text-violet-900">
                  {s.content}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <div className="text-[10px] font-bold text-amber-700">
                  القواعد
                </div>
                <div className="mt-0.5 text-lg font-black text-amber-900">
                  {s.grammar}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-[10px] font-bold text-emerald-700">
                  المفردات
                </div>
                <div className="mt-0.5 text-lg font-black text-emerald-900">
                  {s.vocabulary}
                </div>
              </div>
            </div>

            {result.feedback ? (
              <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-right">
                <p className="text-xs font-black text-violet-800">
                  🤖 ملاحظات المصحح الآلي
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-violet-950">
                  {result.feedback}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          💡 يمكن لمعلمك تعديل الدرجة يدويًا إذا رغب.
        </section>
      </div>
    </main>
  );
}