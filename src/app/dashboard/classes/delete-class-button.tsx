"use client";

import { useRef, useState } from "react";
import { deleteClass } from "./actions";

export type ClassDeleteCounts = {
  students: number;
  practiceAnswers: number;
  catchupProgress: number;
  gameResults: number;
  essaySubmissions: number;
};

export function DeleteClassButton({
  classId,
  className,
  counts,
  label,
  confirmText,
  cancelText = "Batal",
}: {
  classId: string;
  className: string;
  counts: ClassDeleteCounts;
  label: string;
  confirmText: string;
  cancelText?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [typedName, setTypedName] = useState("");

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  //
  // Penjaga tambahan (perintah pemilik, 18 Nov 2026): menghapus kelas
  // menghapus seluruh siswa dan semua pekerjaan mereka lewat rantai
  // cascade basis data. Modal ini menampilkan hitungan pekerjaan itu
  // dengan jelas dan mewajibkan guru mengetik nama kelas persis
  // sebelum tombol hapus aktif; server memeriksa ulang ketikan itu
  // di deleteClass, jadi melewati modal ini lewat jalur lain tetap
  // tertolak.
  const nameMatches = typedName === className;

  const closeModal = () => {
    setShowConfirm(false);
    setTypedName("");
  };

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
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-900">
              <p className="font-bold">
                Yang ikut terhapus dari kelas &quot;{className}&quot;:
              </p>
              <ul className="mt-1 list-inside list-disc">
                <li>{counts.students} siswa beserta akun masuk mereka</li>
                <li>{counts.practiceAnswers} jawaban latihan siswa</li>
                <li>{counts.catchupProgress} progres Tugas Susulan</li>
                <li>{counts.gameResults} hasil game solo</li>
                <li>{counts.essaySubmissions} pengumpulan esai</li>
              </ul>
            </div>
            <label className="mt-4 block text-sm font-semibold text-neutral-800">
              Ketik nama kelas persis untuk melanjutkan:{" "}
              <span className="font-black">{className}</span>
              <input
                type="text"
                name="confirm_name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
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
                disabled={submitting || !nameMatches}
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
