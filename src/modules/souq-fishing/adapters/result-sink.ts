import type {
  FinalTeamResult,
  IndividualSubmissionPayload,
  ResultSinkAdapter,
} from "./types";

/**
 * MagguruResultSinkAdapter — BELUM TERHUBUNG ke backend.
 *
 * Modul Souq Fishing belum dipasang ke rute/UI mana pun di aplikasi.
 * Versi sebelumnya adalah stub Phase 1 yang mengembalikan keberhasilan
 * karangan: setiap jawaban dinyatakan diterima, benar, dan berskor 100,
 * dan laporan proyektor dinyatakan tersimpan, tanpa memanggil backend
 * apa pun. Stub itu dinetralkan: kedua method sekarang melempar error
 * eksplisit, supaya bila suatu hari UI modul ini dipasang sebelum adaptor
 * disambungkan ke `/api/projector/save-report` dan RPC
 * `submit_game_answer`, kegagalannya terlihat keras saat pengembangan,
 * bukan tercatat senyap sebagai nilai palsu siswa.
 */
const NOT_CONNECTED_ERROR =
  "SOUQ_FISHING_NOT_CONNECTED: MagguruResultSinkAdapter belum terhubung ke backend Magguru; jawaban/laporan Souq Fishing tidak dapat dinilai atau disimpan.";

export class MagguruResultSinkAdapter implements ResultSinkAdapter {
  async submitProjectorReport(
    roomId: string,
    roomCode: string,
    results: FinalTeamResult[],
  ): Promise<{ success: boolean; error?: string }> {
    throw new Error(
      `${NOT_CONNECTED_ERROR} Laporan untuk room ${roomCode} (${roomId}) berisi ${results.length} hasil tim dan TIDAK tersimpan.`,
    );
  }

  async submitStudentAnswer(
    submission: IndividualSubmissionPayload,
  ): Promise<{ accepted: boolean; isCorrect: boolean; scoreAwarded: number }> {
    throw new Error(
      `${NOT_CONNECTED_ERROR} Jawaban untuk soal ${submission.questionId} TIDAK dinilai.`,
    );
  }
}
