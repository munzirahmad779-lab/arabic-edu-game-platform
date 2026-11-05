"use client";

import { useRef, useState } from "react";
import { deleteClass } from "./actions";

export function DeleteClassButton({
  classId,
  label,
  confirmText,
  cancelText = "Batal",
}: {
  classId: string;
  label: string;
  confirmText: string;
  cancelText?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  return (
    <form ref={formRef} action={deleteClass}>
      <input type="hidden" name="id" value={classId} />
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
      >
        {label}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {confirmText}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitting(true);
                  formRef.current?.requestSubmit();
                }}
                disabled={submitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {label}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
