"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StatsRow = {
  question_id: string;
  question_text: string | null;
  correct_option_key: string | null;
  explanation: string | null;
  options: Array<{ id: string; option_key: string; option_text: string }>;
  total_answered: number;
  total_correct: number;
  selected_a_count: number;
  selected_b_count: number;
  selected_c_count: number;
  selected_d_count: number;
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

export function SessionQuestionAnalysis({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient() as unknown as RpcClient;
        const { data, error } = await supabase.rpc<StatsRow>(
          "get_session_question_stats",
          { p_session_id: sessionId },
        );
        if (!alive) return;
        if (!error && data) setRows(data);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <p className="text-center text-sm text-slate-500">جاري التحميل...</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500">
        لا توجد بيانات تحليل لهذه الجلسة.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r, idx) => {
        const correctPct =
          r.total_answered > 0
            ? Math.round((r.total_correct / r.total_answered) * 100)
            : 0;

        const counts: Record<string, number> = {
          A: r.selected_a_count,
          B: r.selected_b_count,
          C: r.selected_c_count,
          D: r.selected_d_count,
        };

        return (
          <article
            key={r.question_id}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                سؤال {idx + 1}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  correctPct >= 70
                    ? "bg-emerald-100 text-emerald-800"
                    : correctPct >= 40
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {r.total_correct}/{r.total_answered} صحيح ({correctPct}%)
              </span>
            </div>

            <p className="mt-2 text-sm font-bold leading-7 text-slate-900">
              {r.question_text ?? "(سؤال بلا نص)"}
            </p>

            <div className="mt-3 space-y-1.5">
              {r.options.map((opt) => {
                const isCorrect = opt.option_key === r.correct_option_key;
                const cnt = counts[opt.option_key] ?? 0;
                const pct =
                  r.total_answered > 0
                    ? Math.round((cnt / r.total_answered) * 100)
                    : 0;

                return (
                  <div
                    key={opt.id}
                    className={`rounded-lg border p-2 text-xs ${
                      isCorrect
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">
                        <span className="font-black">{opt.option_key}.</span>{" "}
                        {opt.option_text}
                      </span>
                      <span
                        className={`shrink-0 font-black ${
                          isCorrect ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {cnt} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full ${
                          isCorrect ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {r.explanation && r.explanation.trim().length > 0 ? (
              <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2 text-xs leading-6 text-violet-900">
                💡 <b>الشرح:</b> {r.explanation}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}