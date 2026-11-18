"use client";

import { useRef, useState } from "react";
import { deleteStudent } from "./actions";

export function DeleteStudentButton({
  studentId,
  classId,
  labels,
  scopeText,
}: {
  studentId: string;
  classId: string;
  labels: {
    deleteLabel: string;
    cancelLabel: string;
    confirmMessage: string;
  };
  // Rincian hitungan data siswa yang ikut terhapus (perintah
  // pemilik, 18 Nov 2026), dihitung server di halaman siswa dan
  // ditampilkan apa adanya di modal ini.
  scopeText?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi hapus memakai modal di dalam halaman, BUKAN submit
  // langsung: satu klik pada tombol hapus tidak boleh menghapus
  // siswa tanpa persetujuan eksplisit di modal ini.
  return (
    <>
      <form ref={formRef} action={deleteStudent}>
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="class_id" value={classId} />
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-lg bg-red-100 px-3 py-1.5 text-[10px] font-black text-red-700 transition hover:bg-red-200"
        >
          {labels.deleteLabel}
        </button>
      </form>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {labels.confirmMessage}
            </p>
            {scopeText ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900">
                {scopeText}
              </p>
            ) : null}
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
