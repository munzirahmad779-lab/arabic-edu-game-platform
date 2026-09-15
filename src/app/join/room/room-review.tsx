"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  question_position: number;
  question_text: string | null;
  correct_option_key: string | null;
  explanation: string | null;
  options: Array<{ id: string; option_key: string; option_text: string }>;
  selected_option_key: string | null;
  is_correct: boolean;
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

export function RoomReview({ token }: { token: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient() as unknown as RpcClient;
        const { data, error } = await supabase.rpc<Row>(
          "student_get_my_room_answers",
          { p_join_token: token },
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
  }, [token]);

  if (loading) return null;
  if (rows.length === 0) return null;

  const wrongRows = rows.filter((r) => !r.is_correct);

  return (
    <section className="rounded-[2rem] bg-white/10 p-5 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-right"
      >
        <div>
          <h2 className="text-lg font-black text-white">
            📋 راجع إجاباتك
          </h2>
          <p className="mt-1 text-xs text-white/70">
            {wrongRows.length > 0
              ? `${wrongRows.length} إجابة خاطئة من ${rows.length}`
              : "كل الإجابات صحيحة 🎉"}
          </p>
        </div>
        <span className="text-2xl text-white/70">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          {rows.map((r, idx) => {
            const isWrong = !r.is_correct;
            const explanationShown = revealed[idx];

            return (
              <article
                key={idx}
                className={`rounded-2xl border-2 bg-white p-4 ${
                  isWrong ? "border-rose-300" : "border-emerald-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    السؤال {idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      isWrong
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isWrong ? "✗ خطأ" : "✓ صحيح"}
                  </span>
                </div>

                <p className="mt-3 text-base font-bold leading-8 text-slate-900">
                  {r.question_text ?? "(سؤال بلا نص)"}
                </p>

                <div className="mt-3 space-y-2">
                  {r.options.map((opt) => {
                    const isCorrectOpt =
                      opt.option_key === r.correct_option_key;
                    const isSelected = opt.option_key === r.selected_option_key;

                    let cls =
                      "rounded-xl border-2 border-slate-200 bg-slate-50 p-2.5 text-sm";
                    if (isCorrectOpt) {
                      cls =
                        "rounded-xl border-2 border-emerald-400 bg-emerald-50 p-2.5 text-sm font-bold text-emerald-900";
                    } else if (isSelected && isWrong) {
                      cls =
                        "rounded-xl border-2 border-rose-400 bg-rose-50 p-2.5 text-sm font-bold text-rose-900";
                    } else {
                      cls =
                        "rounded-xl border-2 border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-600 opacity-70";
                    }

                    return (
                      <div key={opt.id} className={cls}>
                        <span className="font-black">{opt.option_key}.</span>{" "}
                        {opt.option_text}
                        {isCorrectOpt ? (
                          <span className="mr-2 text-xs font-black">
                            ✓ الإجابة الصحيحة
                          </span>
                        ) : null}
                        {isSelected && isWrong ? (
                          <span className="mr-2 text-xs font-black">
                            ✗ اختيارك
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {isWrong ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((prev) => ({
                          ...prev,
                          [idx]: !prev[idx],
                        }))
                      }
                      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-black text-violet-800 transition hover:bg-violet-100"
                    >
                      {explanationShown ? "إخفاء السبب" : "لماذا؟ 🤔"}
                    </button>

                    {explanationShown ? (
                      <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm leading-7 text-violet-950">
                        {r.explanation && r.explanation.trim().length > 0
                          ? r.explanation
                          : "لا يوجد شرح متاح لهذا السؤال."}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}