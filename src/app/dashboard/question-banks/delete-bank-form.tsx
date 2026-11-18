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
  submissionCount,
  practiceAnswerCount,
  qd,
}: {
  bankId: string;
  bankName: string;
  questionCount: number;
  // Hitungan jawaban untuk modal (perintah pemilik, 18 Nov 2026),
  // dibaca server di halaman bank soal lewat RPC
  // teacher_scope_counts_bank (migrasi 0133): submissions adalah
  // jawaban ruangan yang ikut terhapus bersama bank menurut
  // desain RPC delete_question_bank, sedangkan jawaban latihan
  // membuat penghapusan DITOLAK oleh penjaga migrasi 0131.
  // Keduanya boleh kosong (undefined/null) bila RPC gagal: modal
  // lalu tampil tanpa baris hitungan, bukan dengan angka 0 palsu.
  // Bila RPC menjawab, baris hitungan SELALU tampil, termasuk
  // bila angkanya 0, dengan penekanan peringatan hanya bila
  // angkanya lebih dari 0.
  submissionCount?: number | null;
  practiceAnswerCount?: number | null;
  qd: DeleteDict;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  const baseMessage =
    questionCount > 0
      ? fmt(qd.confirm_with_questions, {
          name: bankName,
          n: questionCount,
        })
      : fmt(qd.confirm_empty, { name: bankName });

  // Baris hitungan selalu tampil bila RPC menjawab (termasuk
  // angka 0); penekanan peringatan hanya bila ada angka yang
  // lebih dari 0. Bila RPC gagal, countsKnown false dan modal
  // tampil tanpa baris hitungan sama sekali.
  const countsKnown =
    typeof submissionCount === "number" &&
    typeof practiceAnswerCount === "number";
  const countsWarn =
    countsKnown && (submissionCount > 0 || practiceAnswerCount > 0);

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
              {baseMessage}
            </p>
            {countsKnown ? (
              <div
                className={`mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  countsWarn
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                <p>
                  Jawaban ruangan yang ikut terhapus: {submissionCount}.
                  Jawaban latihan siswa: {practiceAnswerCount}.
                </p>
                {submissionCount > 0 ? (
                  <p className="mt-1">
                    Jawaban ruangan di atas ikut terhapus permanen bersama
                    bank ini.
                  </p>
                ) : null}
                {practiceAnswerCount > 0 ? (
                  <p className="mt-1 font-semibold">
                    Karena sudah ada jawaban latihan siswa, penghapusan bank
                    ini akan ditolak: jawaban latihan siswa tidak boleh ikut
                    terhapus.
                  </p>
                ) : null}
              </div>
            ) : null}
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