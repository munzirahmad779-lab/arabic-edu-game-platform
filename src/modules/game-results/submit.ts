"use client";

import { submitGameResultAction } from "./actions";

export type StudentGameResult = {
  /** Skor akhir permainan (skala poin permainan itu sendiri). */
  score: number;
  /** Jumlah jawaban benar siswa pada sesi itu. */
  correct: number;
  /** Jumlah soal yang dijawab siswa pada sesi itu. */
  total: number;
};

/**
 * Helper klien bersama untuk mencatat hasil permainan solo siswa.
 * Dipanggil tiap permainan yang dibuka untuk siswa tepat saat sesi
 * permainannya selesai (layar hasil), hanya pada mode siswa; mode guru
 * tidak memanggilnya. Kegagalan jaringan tidak melempar galat ke
 * permainan: hasil cukup dicatat bila server menerimanya, permainan
 * tetap berjalan seperti biasa.
 */
export async function submitStudentGameResult(
  gameSlug: string,
  result: StudentGameResult,
): Promise<boolean> {
  const score = Math.max(0, Math.round(result.score) || 0);
  const total = Math.max(0, Math.round(result.total) || 0);
  const correct = Math.min(total, Math.max(0, Math.round(result.correct) || 0));
  try {
    const res = await submitGameResultAction(gameSlug, score, correct, total);
    return res.ok;
  } catch {
    return false;
  }
}
