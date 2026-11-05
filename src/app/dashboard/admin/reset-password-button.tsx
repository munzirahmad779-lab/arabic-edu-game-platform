"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

export function ResetPasswordButton({
  email,
  name,
  dict,
}: {
  email: string;
  name: string;
  dict: Dict;
}) {
  const t = dict.admin;
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam) sehingga aksi berhenti tanpa jejak.
  // Pemberitahuan hasil juga dirender di dalam halaman, BUKAN alert(),
  // dengan alasan yang sama.
  async function handleSend() {
    if (sending) return;

    setSending(true);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setNotice({
          tone: "error",
          text: `${t.error_prefix} ${error.message}`,
        });
      } else {
        setNotice({
          tone: "success",
          text: `${t.reset_success_prefix} ${email}${t.reset_success_suffix}`,
        });
      }
    } catch {
      setNotice({ tone: "error", text: t.connection_error });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={sending}
        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
        title={t.reset_title}
      >
        {sending ? "..." : t.reset_btn}
      </button>

      {notice ? (
        <p
          className={`flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={dict.common.cancel}
            className="shrink-0 font-black opacity-60 transition hover:opacity-100"
          >
            ✕
          </button>
        </p>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`${t.reset_confirm_prefix} "${name || email}"${t.reset_confirm_suffix}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  void handleSend();
                }}
                disabled={sending}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {t.reset_btn}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}