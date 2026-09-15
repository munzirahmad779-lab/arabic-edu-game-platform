import { createClient } from "@/lib/supabase/server";

type HistoryRow = {
  student_id: string;
  student_name: string;
  mode: string;
  sessions_count: number;
  best_score: number | null;
  avg_score: number | null;
  correct_count: number;
  total_questions: number;
  last_activity: string | null;
};

const MODE_AR: Record<string, string> = {
  competitive: "تنافسي",
  cooperative: "تعاوني",
  endless: "بلا نهاية",
  practice: "تمرين",
  learning: "تعليمي",
};

const MODE_COLOR: Record<string, string> = {
  competitive: "bg-amber-100 text-amber-800",
  cooperative: "bg-violet-100 text-violet-800",
  endless: "bg-emerald-100 text-emerald-800",
  practice: "bg-sky-100 text-sky-800",
  learning: "bg-neutral-100 text-neutral-700",
};

function formatDate(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export async function ClassHistoryTab({ classId }: { classId: string }) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("teacher_class_history", {
    p_class_id: classId,
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        تعذر تحميل السجل: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as HistoryRow[];

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <div className="text-4xl">📊</div>
        <p className="mt-3 text-sm font-bold text-neutral-700">
          لا توجد نتائج بعد لهذا الفصل
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          عندما يلعب الطلاب أو يتدربون، ستظهر النتائج هنا.
        </p>
      </div>
    );
  }

  // Group by student
  const byStudent = new Map<string, { name: string; rows: HistoryRow[] }>();
  for (const r of rows) {
    if (!byStudent.has(r.student_id)) {
      byStudent.set(r.student_id, { name: r.student_name, rows: [] });
    }
    byStudent.get(r.student_id)!.rows.push(r);
  }

  const students = Array.from(byStudent.entries());

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        💡 اضغط على اسم الطالب لعرض تفاصيل كل وضع (تنافسي، تعاوني، بلا نهاية،
        تمرين).
      </div>

      <div className="space-y-3">
        {students.map(([studentId, info]) => {
          const totalCorrect = info.rows.reduce(
            (sum, r) => sum + r.correct_count,
            0,
          );
          const totalQ = info.rows.reduce(
            (sum, r) => sum + r.total_questions,
            0,
          );
          const overallPct =
            totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

          return (
            <details
              key={studentId}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-neutral-50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white">
                    {info.name.trim().charAt(0) || "ط"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-neutral-900">
                      {info.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {info.rows.length} وضع · {totalCorrect}/{totalQ} صحيح (
                      {overallPct}%)
                    </p>
                  </div>
                </div>
                <span className="text-2xl text-neutral-400">▾</span>
              </summary>

              <div className="border-t border-neutral-100 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {info.rows.map((r) => {
                    const pct =
                      r.total_questions > 0
                        ? Math.round(
                            (r.correct_count / r.total_questions) * 100,
                          )
                        : 0;

                    return (
                      <div
                        key={r.mode}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              MODE_COLOR[r.mode] ??
                              "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {MODE_AR[r.mode] ?? r.mode}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {r.sessions_count} جلسة
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                          {r.best_score !== null ? (
                            <div className="rounded-xl bg-white p-2">
                              <div className="text-[10px] font-bold text-neutral-500">
                                أفضل نتيجة
                              </div>
                              <div className="mt-0.5 text-lg font-black text-emerald-700">
                                {r.best_score}
                              </div>
                            </div>
                          ) : null}
                          {r.avg_score !== null ? (
                            <div className="rounded-xl bg-white p-2">
                              <div className="text-[10px] font-bold text-neutral-500">
                                المتوسط
                              </div>
                              <div className="mt-0.5 text-lg font-black text-violet-700">
                                {r.avg_score}
                              </div>
                            </div>
                          ) : null}
                          <div className="rounded-xl bg-white p-2">
                            <div className="text-[10px] font-bold text-neutral-500">
                              صحيح
                            </div>
                            <div className="mt-0.5 text-lg font-black text-neutral-800">
                              {r.correct_count}/{r.total_questions}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white p-2">
                            <div className="text-[10px] font-bold text-neutral-500">
                              النسبة
                            </div>
                            <div className="mt-0.5 text-lg font-black text-amber-700">
                              {pct}%
                            </div>
                          </div>
                        </div>

                        <p className="mt-2 text-center text-[10px] text-neutral-400">
                          آخر نشاط: {formatDate(r.last_activity)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}