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
  const [logoutMsg, setLogoutMsg] = useState<string | null>(null);
  const [pendingLogout, setPendingLogout] = useState<Session | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam) sehingga aksi berhenti tanpa jejak.
  // Pemberitahuan hasil juga dirender di dalam halaman, BUKAN alert(),
  // dengan alasan yang sama.
  async function logoutOne(s: Session) {
    if (processing) return;

    setProcessing(s.student_id);
    setLogoutMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "admin_force_logout_student",
        { p_student_id: s.student_id },
      );
      if (error) {
        setLogoutMsg(`${t.error_prefix} ${error.message}`);
        setProcessing(null);
      } else {
        forceReload();
      }
    } catch {
      setLogoutMsg(t.connection_error);
      setProcessing(null);
    }
  }

  async function cleanupExpired() {
    if (cleaning) return;

    setCleaning(true);
    setCleanMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
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
          onClick={() => setShowCleanupConfirm(true)}
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

      {logoutMsg ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
          {logoutMsg}
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
                      onClick={() => setPendingLogout(s)}
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

      {pendingLogout ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`${t.sessions_end_confirm_prefix} "${pendingLogout.student_name}"${t.sessions_end_confirm_suffix}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLogout(null)}
                disabled={processing !== null}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = pendingLogout;
                  setPendingLogout(null);
                  void logoutOne(s);
                }}
                disabled={processing !== null}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {t.sessions_btn_end}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCleanupConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {t.sessions_cleanup_confirm}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCleanupConfirm(false)}
                disabled={cleaning}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCleanupConfirm(false);
                  void cleanupExpired();
                }}
                disabled={cleaning}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {t.sessions_cleanup_btn}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}