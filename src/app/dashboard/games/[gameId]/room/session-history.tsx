"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SessionQuestionAnalysis } from "./session-question-analysis";

type SessionRow = {
  session_id: string;
  session_number: number;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
};

type DetailRow = {
  participant_name: string;
  final_score: number;
  rank: number;
  correct_count: number;
  total_questions: number;
  avg_response_ms: number;
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

function formatDate(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const h = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min} UTC`;
  } catch {
    return "—";
  }
}

export default function SessionHistory({
  sessions,
}: {
  sessions: SessionRow[];
}) {
  const [mounted, setMounted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailRow[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function toggle(sessionId: string) {
    if (openId === sessionId) {
      setOpenId(null);
      return;
    }
    setOpenId(sessionId);
    if (details[sessionId]) return;

    setLoading(true);
    try {
      const supabase = createClient() as unknown as RpcClient;
      const { data, error } = await supabase.rpc<DetailRow>(
        "get_room_session_detail",
        { p_session_id: sessionId },
      );
      if (!error && data) {
        setDetails((prev) => ({ ...prev, [sessionId]: data }));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (sessions.length === 0) {
    return (
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-xl">
        <h2 className="text-xl font-black text-slate-950">
          📜 سجل الجلسات السابقة
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          لا توجد جلسات مؤرشفة بعد.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950">
          📜 سجل الجلسات السابقة
        </h2>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
          {sessions.length}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {sessions.map((s) => {
          const open = openId === s.session_id;
          const rows = details[s.session_id];
          return (
            <div
              key={s.session_id}
              className="rounded-2xl border border-slate-200 bg-slate-50"
            >
              <button
                type="button"
                onClick={() => void toggle(s.session_id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-slate-100"
              >
                <div>
                  <div className="font-black text-slate-900">
                    الجلسة #{s.session_number}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {mounted ? formatDate(s.started_at) : "..."} —{" "}
                    {s.participant_count} طالب
                  </div>
                </div>
                <span className="text-2xl text-slate-400">
                  {open ? "−" : "+"}
                </span>
              </button>

              {open ? (
                <div className="border-t border-slate-200 bg-white p-3">
                  {loading && !rows ? (
                    <p className="text-center text-sm text-slate-500">
                      جاري التحميل...
                    </p>
                  ) : !rows || rows.length === 0 ? (
                    <p className="text-center text-sm text-slate-500">
                      لا توجد بيانات.
                    </p>
                  ) : (
                    <div className="overflow-auto rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">
                              #
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">
                              الاسم
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">
                              صحيح
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">
                              النقاط
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr
                              key={i}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2 font-black">
                                {r.rank}
                              </td>
                              <td className="px-3 py-2 font-bold text-slate-800">
                                {r.participant_name}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {r.correct_count} / {r.total_questions}
                              </td>
                              <td className="px-3 py-2 font-mono font-black text-violet-700">
                                {r.final_score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <h4 className="mb-2 text-xs font-black text-slate-700">
                      📊 تحليل الأسئلة
                    </h4>
                    <SessionQuestionAnalysis sessionId={s.session_id} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}