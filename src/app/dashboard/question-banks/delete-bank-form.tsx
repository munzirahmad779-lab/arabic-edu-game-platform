"use client";

import { useRef, useState } from "react";
import { deleteQuestionBank } from "./actions";

type DeleteDict = {
  button: string;
  title: string;
  confirm_with_questions: string;
  confirm_empty: string;
  cancel?: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function DeleteBankForm({
  bankId,
  bankName,
  questionCount,
  qd,
}: {
  bankId: string;
  bankName: string;
  questionCount: number;
  qd: DeleteDict;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  const message =
    questionCount > 0
      ? fmt(qd.confirm_with_questions, {
          name: bankName,
          n: questionCount,
        })
      : fmt(qd.confirm_empty, { name: bankName });

  return (
    <form ref={formRef} action={deleteQuestionBank}>
      <input type="hidden" name="bank_id" value={bankId} />
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
        title={qd.title}
      >
        {qd.button}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {message}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {qd.cancel ?? "Batal"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitting(true);
                  formRef.current?.requestSubmit();
                }}
                disabled={submitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {qd.button}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}