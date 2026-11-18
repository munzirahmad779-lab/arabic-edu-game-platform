/**
 * Hitungan kemajuan Langkah 1 (Baca Materi) Tugas Susulan.
 *
 * Kemajuan dihitung dari guliran HALAMAN bacaan itu sendiri
 * (document.documentElement), bukan dari isi bingkai PDF. Bingkai PDF
 * adalah konteks penelusuran terpisah: di HP Android PDF di dalam
 * iframe tidak tampil sama sekali dan sentuhan yang mulai di atas
 * iframe tidak menggulir halaman induk, jadi kemajuan tidak boleh
 * bergantung pada bingkai itu.
 *
 * Fungsi di sini murni (tanpa DOM) supaya bisa diuji langsung.
 */

export interface UkuranGulir {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Persen kemajuan yang memicu penyelesaian langkah secara otomatis. */
export const AMBANG_SELESAI_OTOMATIS = 95;

/** Persen kemajuan minimum agar tombol "Selesai Membaca" aktif. */
export const AMBANG_TOMBOL_SELESAI = 90;

/** Toleransi piksel untuk menganggap siswa sudah di dasar halaman. */
const TOLERANSI_BAWAH_PX = 2;

/**
 * Persen bacaan yang sudah digulir, bilangan bulat 0 s.d. 100.
 * Penyebut adalah tinggi gulir yang benar: tinggi dokumen dikurangi
 * tinggi layar. Halaman yang muat satu layar (penyebut <= 0) dianggap
 * sudah terbaca sampai akhir. Nilai selalu dijepit 0-100, termasuk
 * untuk gulir memantul (scrollTop negatif atau melebihi maksimum).
 */
export function hitungPersenBaca(u: UkuranGulir): number {
  const rentang = u.scrollHeight - u.clientHeight;
  if (rentang <= 0) return 100;
  const mentah = (u.scrollTop / rentang) * 100;
  return Math.min(100, Math.max(0, Math.round(mentah)));
}

/** Benar bila posisi gulir sudah mencapai dasar halaman. */
export function sudahSampaiBawah(u: UkuranGulir): boolean {
  if (u.scrollHeight <= u.clientHeight) return true;
  return u.scrollTop + u.clientHeight >= u.scrollHeight - TOLERANSI_BAWAH_PX;
}

/** Benar bila langkah baca boleh dicatat selesai secara otomatis. */
export function bacaDianggapSelesai(u: UkuranGulir): boolean {
  return hitungPersenBaca(u) >= AMBANG_SELESAI_OTOMATIS || sudahSampaiBawah(u);
}

/** Benar bila tombol "Selesai Membaca" boleh ditekan siswa. */
export function tombolSelesaiAktif(u: UkuranGulir): boolean {
  return hitungPersenBaca(u) >= AMBANG_TOMBOL_SELESAI || sudahSampaiBawah(u);
}
