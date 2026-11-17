/**
 * Aturan kunci Game Solo siswa (perintah pemilik, 17 Nov 2026,
 * ditegaskan ulang malam yang sama: "eh 7 dars").
 *
 * Game Solo terbuka bila siswa sudah menyelesaikan Latihan Siswa
 * untuk 7 dars yang berbeda sampai tuntas. Hitungannya dars, bukan
 * mencapai dars tertentu: latihan yang dihitung adalah yang namanya
 * memuat nomor dars (pola "Dars N ..." dan "Review Dars N ...",
 * keduanya memetakan ke dars N) dan sudah dijawab tuntas, yaitu
 * answered_count mencapai total soalnya. Permainan tanpa nomor dars
 * pada namanya, misalnya Campuran, tidak menambah hitungan. Dua
 * permainan untuk dars yang sama tetap dihitung satu dars.
 *
 * Sumber data: RPC student_list_practice_games (migrasi 0114 memberi
 * answered_count dan correct_count), data yang sama dengan lencana
 * progres pada daftar Latihan Mandiri.
 */

export const SYARAT_JUMLAH_DARS_TUNTAS = 7;

export type LatihanRingkasan = {
  name: string;
  question_count: number;
  answered_count?: number | null;
  correct_count?: number | null;
};

/**
 * Petakan nama permainan latihan ke nomor darsnya. Mengembalikan
 * null bila nama tidak memuat satu nomor dars yang jelas, termasuk
 * rentang seperti "Dars 1-5" pada permainan Campuran.
 */
export function nomorDarsDariNamaLatihan(nama: string): number | null {
  const cocok = /dars\s+(\d{1,2})/i.exec(nama);
  if (!cocok) return null;
  const sesudah = nama.slice((cocok.index ?? 0) + cocok[0].length);
  // Angka yang lebih panjang dari dua digit bukan nomor dars.
  if (/^\d/.test(sesudah)) return null;
  // Rentang seperti "Dars 1-5" bukan satu dars.
  if (/^\s*[-–]\s*\d/.test(sesudah)) return null;
  const n = Number(cocok[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** Latihan disebut tuntas bila semua soalnya sudah dijawab. */
export function latihanTuntas(latihan: LatihanRingkasan): boolean {
  return (
    latihan.question_count > 0 &&
    (latihan.answered_count ?? 0) >= latihan.question_count
  );
}

/** Nomor dars yang latihannya sudah tuntas, unik dan terurut. */
export function daftarDarsTuntas(games: LatihanRingkasan[]): number[] {
  const unik = new Set<number>();
  for (const game of games) {
    if (!latihanTuntas(game)) continue;
    const dars = nomorDarsDariNamaLatihan(game.name);
    if (dars !== null) unik.add(dars);
  }
  return [...unik].sort((a, b) => a - b);
}

export function hitungDarsTuntas(games: LatihanRingkasan[]): number {
  return daftarDarsTuntas(games).length;
}

/** Game Solo terbuka bila jumlah dars tuntas mencapai syarat. */
export function gameSoloTerbuka(games: LatihanRingkasan[]): boolean {
  return hitungDarsTuntas(games) >= SYARAT_JUMLAH_DARS_TUNTAS;
}
