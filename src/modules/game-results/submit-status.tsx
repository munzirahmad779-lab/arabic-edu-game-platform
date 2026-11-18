"use client";

import { useCallback, useRef, useState } from "react";
import {
  submitStudentGameResult,
  type StudentGameResult,
} from "./submit";

export type StatusKirimHasil = "belum" | "mengirim" | "tercatat" | "gagal";

/**
 * Pengait pencatatan hasil game solo yang BERSUARA (perbaikan audit
 * 18 Nov 2026). Sebelumnya kelima game memanggil
 * submitStudentGameResult dengan `void` dan tidak pernah membaca
 * nilai kembali boolean-nya, jadi kegagalan kirim (sesi kedaluwarsa,
 * jaringan putus tepat di akhir ronde) hilang diam-diam sementara
 * siswa tetap melihat layar hasil biasa.
 *
 * Pengait ini menyimpan data hasil terakhir dan status kirimnya:
 * "tercatat" hanya sesudah server menerima, "gagal" membuka jalan
 * kirim ulang dengan data yang sama lewat kirimUlang.
 */
export function useStudentResultSubmit(gameSlug: string) {
  const [status, setStatus] = useState<StatusKirimHasil>("belum");
  const payloadRef = useRef<StudentGameResult | null>(null);
  const sibukRef = useRef(false);

  const kirim = useCallback(
    async (result: StudentGameResult): Promise<boolean> => {
      payloadRef.current = result;
      setStatus("mengirim");
      const ok = await submitStudentGameResult(gameSlug, result);
      setStatus(ok ? "tercatat" : "gagal");
      return ok;
    },
    [gameSlug],
  );

  const kirimUlang = useCallback(async (): Promise<boolean> => {
    if (!payloadRef.current || sibukRef.current) return false;
    sibukRef.current = true;
    try {
      return await kirim(payloadRef.current);
    } finally {
      sibukRef.current = false;
    }
  }, [kirim]);

  return { status, kirim, kirimUlang };
}

/**
 * Catatan status pencatatan hasil di layar hasil game solo.
 * "Hasilmu sudah tercatat" tampil HANYA bila status "tercatat";
 * bila gagal, siswa melihat peringatan jelas dan tombol kirim ulang.
 */
export function StudentResultNote({
  status,
  onRetry,
}: {
  status: StatusKirimHasil;
  onRetry: () => void;
}) {
  if (status === "belum") return null;
  if (status === "mengirim") {
    return (
      <p className="rounded-xl bg-white/85 px-4 py-2 text-center text-sm font-bold text-indigo-950 ring-1 ring-indigo-900/10">
        Mencatat hasilmu...
      </p>
    );
  }
  if (status === "tercatat") {
    return (
      <p className="rounded-xl bg-emerald-100 px-4 py-2 text-center text-sm font-black text-emerald-900 ring-1 ring-emerald-600/20">
        ✓ Hasilmu sudah tercatat.
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-rose-100 px-4 py-3 text-center ring-1 ring-rose-600/25">
      <p className="text-sm font-black text-rose-900">
        Hasilmu belum tercatat. Periksa koneksimu.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 rounded-xl bg-rose-600 px-5 font-black text-white transition hover:bg-rose-500"
      >
        Kirim Ulang Hasil
      </button>
    </div>
  );
}
