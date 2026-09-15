"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  source: string;
  game_name: string;
  game_mode: string;
  student_name: string;
  final_score: number | null;
  rank_position: number | null;
  correct_count: number;
  total_questions: number;
  recorded_at: string;
};

const MODE_AR: Record<string, string> = {
  competitive: "تنافسي",
  cooperative: "تعاوني",
  endless: "بلا نهاية",
  practice: "تمرين",
  learning: "تعليمي",
};

const AI_PROMPT = `أنت مساعد تعليمي متخصص في تحليل أداء الطلاب في اللغة العربية.

سأرفق أدناه تقريرًا يوميًا من منصة تعليمية، يحتوي على:
- نتائج الألعاب التنافسية والتعاونية (بمؤقت)
- نتائج التدريب الذاتي (بلا وقت)

المطلوب:
1. ملخص عام: عدد الجلسات، عدد الطلاب، متوسط الأداء.
2. الطلاب المتميزون: أعلى 3 أداءً مع نسبهم.
3. الطلاب المحتاجون للدعم: من هم أقل من 60% مع توصيات.
4. أنماط ملحوظة: هل هناك صعوبة في وضع معين أو موضوع معين؟
5. توصيات عملية للمعلم: 3-5 إجراءات للغد.

أعد النتيجة بالعربية الفصحى المبسطة، بفقرات وعناوين واضحة ونقاط مرقّمة.

---
`;

function formatTime(v: string): string {
  try {
    const d = new Date(v);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function buildMarkdown(
  date: string,
  roomRows: Row[],
  practiceRows: Row[],
): string {
  const lines: string[] = [];
  lines.push(`# 📊 التقرير اليومي — ${date}`);
  lines.push("");
  lines.push(`**إجمالي الجلسات:** ${roomRows.length + practiceRows.length}`);
  lines.push(`**الألعاب بمؤقت:** ${roomRows.length}`);
  lines.push(`**التدريب الذاتي:** ${practiceRows.length}`);
  lines.push("");

  if (roomRows.length > 0) {
    lines.push("## 🏆 الألعاب التنافسية والتعاونية");
    lines.push("");
    lines.push(
      "| اللعبة | الوضع | الطالب | النقاط | الترتيب | الصحيح | المجموع | الوقت |",
    );
    lines.push(
      "|--------|-------|--------|--------|---------|--------|---------|-------|",
    );
    for (const r of roomRows) {
      lines.push(
        `| ${r.game_name} | ${MODE_AR[r.game_mode] ?? r.game_mode} | ${r.student_name} | ${r.final_score ?? "—"} | ${r.rank_position ?? "—"} | ${r.correct_count} | ${r.total_questions} | ${formatTime(r.recorded_at)} |`,
      );
    }
    lines.push("");
  }

  if (practiceRows.length > 0) {
    lines.push("## 📖 التدريب الذاتي");
    lines.push("");
    lines.push("| الطالب | اللعبة | الوضع | الصحيح | المجموع | النسبة | الوقت |");
    lines.push("|--------|--------|-------|--------|---------|--------|-------|");
    for (const r of practiceRows) {
      const pct =
        r.total_questions > 0
          ? Math.round((r.correct_count / r.total_questions) * 100)
          : 0;
      lines.push(
        `| ${r.student_name} | ${r.game_name} | ${MODE_AR[r.game_mode] ?? r.game_mode} | ${r.correct_count} | ${r.total_questions} | ${pct}% | ${formatTime(r.recorded_at)} |`,
      );
    }
    lines.push("");
  }

  if (roomRows.length === 0 && practiceRows.length === 0) {
    lines.push("_لا توجد بيانات لهذا اليوم._");
    lines.push("");
  }

  lines.push("---");
  lines.push("_تقرير آلي من منصة التعليم العربية_");
  return lines.join("\n");
}

export function ReportView({
  date,
  roomRows,
  practiceRows,
}: {
  date: string;
  roomRows: Row[];
  practiceRows: Row[];
}) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

  const mdText = buildMarkdown(date, roomRows, practiceRows);

  async function copyMd() {
    try {
      await navigator.clipboard.writeText(mdText);
      setCopiedMd(true);
      window.setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyAi() {
    try {
      const full = `${AI_PROMPT}\n${mdText}`;
      await navigator.clipboard.writeText(full);
      setCopiedAi(true);
      window.setTimeout(() => setCopiedAi(false), 2000);
    } catch {
      // ignore
    }
  }

  async function cleanup() {
    if (cleaning) return;
    if (
      !window.confirm(
        "سيتم حذف جميع السجلات الأقدم من 7 أيام. متابعة؟",
      )
    ) {
      return;
    }

    setCleaning(true);
    setCleanMsg(null);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("cleanup_old_history");
      if (error) {
        setCleanMsg(`خطأ: ${error.message}`);
      } else {
        setCleanMsg(`✓ تم حذف ${data ?? 0} سجل قديم.`);
      }
    } catch {
      setCleanMsg("تعذر الاتصال بالخادم.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Date picker */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
      >
        <div>
          <label
            htmlFor="date"
            className="block text-xs font-bold text-neutral-700"
          >
            التاريخ
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={date}
            className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white transition hover:bg-violet-700"
        >
          عرض
        </button>
      </form>

      {/* Copy buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void copyMd()}
          className="rounded-2xl bg-gradient-to-l from-slate-700 to-slate-900 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedMd ? "✓ تم النسخ" : "📋 نسخ MD فقط"}
        </button>
        <button
          type="button"
          onClick={() => void copyAi()}
          className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedAi ? "✓ تم النسخ" : "🤖 نسخ MD + Prompt AI"}
        </button>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900">
        <p className="font-black">💡 كيف تستخدم التقرير؟</p>
        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>
            <b>نسخ MD فقط</b> — إذا أردت حفظ التقرير في مستند (Notion /
            Obsidian / Word).
          </li>
          <li>
            <b>نسخ MD + Prompt AI</b> — الصق النتيجة في ChatGPT / Meta AI،
            وسيقوم تلقائيًا بتحليل أداء الطلاب واقتراح توصيات.
          </li>
        </ul>
      </section>

      {/* Room table */}
      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-neutral-900">
            🏆 الألعاب بمؤقت
          </h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {roomRows.length} جلسة
          </span>
        </div>

        {roomRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            لا توجد نتائج لهذا اليوم.
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    اللعبة
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الوضع
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الطالب
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    النقاط
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الترتيب
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الوقت
                  </th>
                </tr>
              </thead>
              <tbody>
                {roomRows.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-bold text-neutral-800">
                      {r.game_name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {MODE_AR[r.game_mode] ?? r.game_mode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2 font-mono font-black text-emerald-700">
                      {r.final_score ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      #{r.rank_position ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {formatTime(r.recorded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Practice table */}
      <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-neutral-900">
            📖 التدريب الذاتي
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {practiceRows.length} سجل
          </span>
        </div>

        {practiceRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            لا توجد نتائج لهذا اليوم.
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الطالب
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    اللعبة
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الوضع
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    صحيح
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    النسبة
                  </th>
                </tr>
              </thead>
              <tbody>
                {practiceRows.map((r, i) => {
                  const pct =
                    r.total_questions > 0
                      ? Math.round(
                          (r.correct_count / r.total_questions) * 100,
                        )
                      : 0;
                  return (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-bold text-neutral-800">
                        {r.student_name}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {r.game_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {MODE_AR[r.game_mode] ?? r.game_mode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-black text-emerald-700">
                        {r.correct_count}/{r.total_questions}
                      </td>
                      <td className="px-3 py-2 font-black text-violet-700">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cleanup section */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-red-800">
              🗑️ مسح السجل القديم
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              حذف جميع السجلات الأقدم من 7 أيام (تلقائيًا أيضًا كل يوم).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cleanup()}
            disabled={cleaning}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {cleaning ? "..." : "🗑️ مسح الآن"}
          </button>
        </div>
        {cleanMsg ? (
          <p className="mt-2 text-xs font-bold text-red-800">{cleanMsg}</p>
        ) : null}
      </section>

      {/* Preview */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="mb-2 text-xs font-black text-neutral-700">
          معاينة التقرير (Markdown)
        </p>
        <pre
          className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-800"
          dir="rtl"
        >
{mdText}
        </pre>
      </section>
    </div>
  );
}