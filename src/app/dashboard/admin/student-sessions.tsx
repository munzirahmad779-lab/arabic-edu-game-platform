"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toWibDateTime } from "@/lib/format-wib";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

type Session = {
  student_id: string;
  student_name: string;
  class_name: string;
  expires_at: string;
  last_seen_at: string;
  created_at: string;
};

function forceReload() {
  if (typeof window === "undefined") return;
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

export function StudentSessions({
  sessions,
  dict,
}: {
  sessions: Session[];
  dict: Dict;
}) {
  const t = dict.admin;
  const [processing, setProcessing] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

  async function logoutOne(s: Session) {
    if (processing) return;
    if (
      !window.confirm(
        `${t.sessions_end_confirm_prefix} "${s.student_name}"${t.sessions_end_confirm_suffix}`,
      )
    ) {
      return;
    }

    setProcessing(s.student_id);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc(
        "admin_force_logout_student",
        { p_student_id: s.student_id },
      );
      if (error) {
        alert(`${t.error_prefix} ${error.message}`);
        setProcessing(null);
      } else {
        forceReload();
      }
    } catch {
      alert(t.connection_error);
      setProcessing(null);
    }
  }

  async function cleanupExpired() {
    if (cleaning) return;
    if (!window.confirm(t.sessions_cleanup_confirm)) return;

    setCleaning(true);
    setCleanMsg(null);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "admin_cleanup_expired_sessions",
      );
      if (error) {
        setCleanMsg(`${t.error_prefix} ${error.message}`);
        setCleaning(false);
      } else {
        setCleanMsg(
          `${t.sessions_cleanup_success_prefix} ${data ?? 0} ${t.sessions_cleanup_success_suffix}`,
        );
        window.setTimeout(() => forceReload(), 1200);
      }
    } catch {
      setCleanMsg(t.connection_error);
      setCleaning(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-neutral-900">
            {t.sessions_title}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">{t.sessions_desc}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
          {sessions.length} {t.sessions_count_suffix}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void cleanupExpired()}
          disabled={cleaning}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
        >
          {cleaning ? "..." : t.sessions_cleanup_btn}
        </button>
      </div>

      {cleanMsg ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          {cleanMsg}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm font-bold text-neutral-700">
            {t.sessions_empty_title}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {t.sessions_empty_desc}
          </p>
        </div>
      ) : (
        <div className="mt-4 max-h-[500px] overflow-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-100">
              <tr>
                <th className="px-3 py-2 text-start font-bold text-neutral-600">
                  {t.sessions_th_student}
                </th>
                <th className="px-3 py-2 text-start font-bold text-neutral-600">
                  {t.sessions_th_class}
                </th>
                <th className="px-3 py-2 text-start font-bold text-neutral-600">
                  {t.sessions_th_last_seen}
                </th>
                <th className="px-3 py-2 text-start font-bold text-neutral-600">
                  {t.sessions_th_expires}
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.student_id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-bold text-neutral-800">
                    {s.student_name}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {s.class_name}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {toWibDateTime(s.last_seen_at)}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-400">
                    {toWibDateTime(s.expires_at)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void logoutOne(s)}
                      disabled={processing === s.student_id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {processing === s.student_id ? "..." : t.sessions_btn_end}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}