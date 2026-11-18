"use client";

import { useRef, useState } from "react";
import { deleteGame } from "./actions";

export function DeleteGameButton({
  gameId,
  gameName,
  title,
  triggerClassName,
  archiveSessionCount,
  archiveSubmissionCount,
}: {
  gameId: string;
  gameName: string;
  title: string;
  triggerClassName: string;
  // Pemberitahuan arsip (perintah pemilik, 18 Nov 2026): jumlah
  // sesi arsip (room_sessions) dan jawaban ruangan (submissions)
  // milik room permainan ini yang ikut terhapus permanen bersama
  // permainan, dibaca server di halaman permainan lewat RPC
  // teacher_scope_counts_game (migrasi 0133). Keduanya boleh
  // kosong (undefined/null) bila RPC gagal: modal lalu tampil
  // tanpa baris hitungan, bukan dengan angka 0 palsu. Bila RPC
  // menjawab, baris hitungan SELALU tampil, termasuk bila
  // angkanya 0, dengan penekanan peringatan hanya bila angkanya
  // lebih dari 0.
  archiveSessionCount?: number | null;
  archiveSubmissionCount?: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Konfirmasi hapus memakai modal di dalam halaman, BUKAN submit
  // langsung dan BUKAN window.confirm: satu klik pada ikon tempat
  // sampah tidak boleh menghapus game tanpa persetujuan eksplisit
  // di modal ini. Komponen ini satu-satunya jalur hapus game dari
  // kartu (daftar Permainan dan GameCardActions memakai komponen
  // yang sama persis).
  return (
    <>
      <form ref={formRef} action={deleteGame}>
        <input type="hidden" name="game_id" value={gameId} />
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          title={title}
          className={triggerClassName}
        >
          🗑
        </button>
      </form>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            dir="ltr"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`Apakah Anda yakin ingin menghapus permainan "${gameName}"?`}
            </p>
            {typeof archiveSessionCount === "number" &&
            typeof archiveSubmissionCount === "number" ? (
              <div
                className={`mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  archiveSessionCount > 0 || archiveSubmissionCount > 0
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                <p>
                  Sesi arsip yang ikut terhapus: {archiveSessionCount}.
                  Jawaban ruangan yang ikut terhapus:{" "}
                  {archiveSubmissionCount}.
                </p>
                {archiveSessionCount > 0 || archiveSubmissionCount > 0 ? (
                  <p className="mt-1">
                    Menghapus permainan ini juga menghapus permanen sesi
                    arsip dan jawaban ruangan di atas. Riwayat sesi yang
                    sudah diarsipkan ikut hilang dan tidak bisa
                    dikembalikan.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(true);
                  formRef.current?.requestSubmit();
                }}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
