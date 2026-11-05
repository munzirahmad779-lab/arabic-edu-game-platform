"use client";

import { useRef, useState } from "react";
import { deleteAssessment } from "./actions";

export function DeleteAssessmentButton({
  assessmentId,
  labels,
}: {
  assessmentId: string;
  labels: {
    deleteLabel: string;
    cancelLabel: string;
    confirmMessage: string;
  };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi hapus memakai modal di dalam halaman, BUKAN submit
  // langsung: satu klik pada ikon tempat sampah tidak boleh menghapus
  // ujian tanpa persetujuan eksplisit di modal ini.
  return (
    <>
      <form ref={formRef} action={deleteAssessment}>
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          title={labels.deleteLabel}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
        >
          🗑
        </button>
      </form>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {labels.confirmMessage}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {labels.cancelLabel}
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
                {labels.deleteLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
