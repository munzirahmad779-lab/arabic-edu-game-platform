// Judul tiap dars untuk fitur Tugas Susulan (judul kartu tugas dan
// judul halaman baca). Daftar ini sebelumnya tinggal di modul data
// kosakata; sesudah fitur kosakata dihapus dari Tugas Susulan atas
// perintah pemilik (19 Nov 2026), judul dars berdiri sendiri di sini.

export const JUDUL_DARS: Record<number, string> = {
  1: "Salam & Perkenalan",
  2: "Keluarga",
  3: "Sekolah",
  4: "Teman",
  5: "Kehidupan Sehari-hari",
  6: "Hobi",
  7: "Rumah",
  8: "Makanan dan Minuman",
  9: "Kesehatan dan Kebersihan",
  10: "Olahraga",
  11: "Tempat dan Arah",
  12: "Lingkungan Sekitar dan Lingkungan Hidup",
  13: "Transportasi",
  14: "Perjalanan dan Wisata",
  15: "Teknologi",
};

/** Judul dars, atau undefined bila nomor dars di luar daftar. */
export function judulDars(dars: number): string | undefined {
  return JUDUL_DARS[dars];
}
