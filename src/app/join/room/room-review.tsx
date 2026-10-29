"use client";

import { useEffect, useState } from "react";
import type idDict from "@/lib/i18n/id.json";

type Dict = Pick<typeof idDict, "join">;

type Row = {
  question_position: number;
  question_text: string | null;
  correct_option_key: string | null;
  explanation: string | null;
  options: Array<{ id: string; option_key: string; option_text: string }>;
  selected_option_key: string | null;
  is_correct: boolean;
};

type ReviewApiRow = Omit<Row, "options"> & { options: unknown };

export function RoomReview({
  token,
  dict,
  isRtl,
}: {
  token: string;
  dict: Dict;
  isRtl: boolean;
}) {
  const t = dict.join;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/rooms/review?token=${encodeURIComponent(token)}`,
        );
        if (!alive) return;
        if (res.ok) {
          const data: unknown = await res.json();
          if (Array.isArray(data)) {
            setRows(
              data.map((value) => {
                const row = value as ReviewApiRow;
                return {
                  ...row,
                  options: (Array.isArray(row.options)
                    ? row.options
                    : []) as Row["options"],
                };
              }),
            );
          }
        }
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
    <section
      className="rounded-[2rem] bg-white/10 p-5 shadow-2xl backdrop-blur"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-start"
      >
        <div>
          <h2 className="text-lg font-black text-white">{t.review_title}</h2>
          <p className="mt-1 text-xs text-white/70">
            {wrongRows.length > 0
              ? `${wrongRows.length} ${t.review_wrong_of} ${rows.length}`
              : t.review_all_correct}
          </p>
        </div>
        <span className="text-2xl text-white/70">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          {rows.map((r, idx) => {
            const isWrong = !r.is_correct;
            const key = `${r.question_position}-${idx}`;
            const explanationShown = revealed[key];

            return (
              <article
                key={key}
                className={`rounded-2xl border-2 bg-white p-4 ${
                  isWrong ? "border-rose-300" : "border-emerald-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {t.review_question_prefix} {idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      isWrong
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isWrong ? t.review_wrong : t.review_correct}
                  </span>
                </div>

                <p className="mt-3 text-base font-bold leading-8 text-slate-900">
                  {r.question_text ?? t.review_no_question_text}
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
                          <span className="ms-2 text-xs font-black">
                            {t.review_correct_mark}
                          </span>
                        ) : null}
                        {isSelected && isWrong ? (
                          <span className="ms-2 text-xs font-black">
                            {t.review_your_mark}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                    className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                  >
                    {explanationShown ? t.review_why_hide : t.review_why}
                  </button>

                  {explanationShown ? (
                    <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-sm leading-7 text-slate-900">
                      {r.explanation && r.explanation.trim().length > 0
                        ? r.explanation
                        : t.review_no_explanation}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
