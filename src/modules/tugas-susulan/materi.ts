// Penyelesai judul materi kelas -> nomor dars untuk fitur Tugas Susulan.
//
// Judul materi terbit di kelas tidak seragam:
// - "Dars N" untuk sebagian besar dars (mis. "Dars 3" s.d. "Dars 9").
// - Pola pertemuan untuk dua dars pertama: "Pertemuan Pertama dan
//   Kedua" (pertemuan 1 dan 2) dan "Pertemuan 3 dan 4".
// Aturan penyelesaian: pola "Dars N" dicocokkan lebih dulu. Bila tidak
// ada, nomor pertemuan diuraikan dari judul (angka digit seperti
// "Pertemuan 3 dan 4" atau "Pertemuan 1-2", dan kata urutan seperti
// "Pertemuan Pertama dan Kedua"), lalu pasangan pertemuan (2d-1, 2d)
// dipetakan ke Dars d.

const KATA_URUTAN: Record<string, number> = {
  pertama: 1,
  kedua: 2,
  ketiga: 3,
  keempat: 4,
  kelima: 5,
  keenam: 6,
  ketujuh: 7,
  kedelapan: 8,
  kesembilan: 9,
  kesepuluh: 10,
  kesebelas: 11,
  keduabelas: 12,
  ketigabelas: 13,
  keempatbelas: 14,
  kelimabelas: 15,
  keenambelas: 16,
  ketujuhbelas: 17,
  kedelapanbelas: 18,
  kesembilanbelas: 19,
  keduapuluh: 20,
};

function nomorPertemuanDariJudul(judul: string): number[] {
  const j = judul.toLowerCase();
  const idx = j.indexOf("pertemuan");
  const sisa = idx >= 0 ? j.slice(idx + "pertemuan".length) : j;

  const ketemu = new Set<number>();
  for (const m of sisa.matchAll(/\d+/g)) {
    ketemu.add(Number(m[0]));
  }
  for (const m of sisa.matchAll(/[a-z]+/g)) {
    const n = KATA_URUTAN[m[0]];
    if (n !== undefined) ketemu.add(n);
  }
  return [...ketemu].sort((a, b) => a - b);
}

/**
 * Kembalikan nomor dars dari judul materi, atau null bila judul tidak
 * bisa dipetakan ke satu dars.
 */
export function darsDariJudulMateri(judul: string): number | null {
  const j = judul.toLowerCase();

  const darsMatch = j.match(/dars\s+(\d+)/);
  if (darsMatch) {
    const n = Number(darsMatch[1]);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }

  const nomor = nomorPertemuanDariJudul(judul);
  if (nomor.length !== 2) return null;
  const [a, b] = nomor;
  if (b !== a + 1 || a % 2 !== 1) return null;
  return (a + 1) / 2;
}

/** True bila materi berjudul ini adalah materi untuk dars tersebut. */
export function cocokMateri(judul: string, dars: number): boolean {
  return darsDariJudulMateri(judul) === dars;
}
