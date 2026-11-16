/**
 * Daftar permainan solo yang dibuka untuk siswa (mode Latihan Mandiri
 * dari akun siswa, rute /student/play/<slug>). Urutan mengikuti
 * prioritas pemilik: permainan utama Magguru lebih dulu.
 *
 * Permainan yang memang tidak solo TIDAK masuk daftar ini:
 * Basket Pengetahuan (duel 2 pemain), Banua Fruit Blast (minimal
 * 2 pemain), Sigetteng-Getteng (tarik tambang antartim).
 */
export type StudentGameInfo = {
  slug: string;
  name: string;
  emoji: string;
  desc: string;
  bankNote: string;
};

export const STUDENT_GAMES: StudentGameInfo[] = [
  {
    slug: "space-war",
    name: "Space War",
    emoji: "🚀",
    desc: "Tembak asteroid soal dengan keypad angka dan tombol pilihan, sendirian melawan waktu.",
    bankNote: "Bank bawaan 34 soal, atau pilih bank kelasmu di Bank Soal dalam game",
  },
  {
    slug: "jejak-angka",
    name: "Jejak Angka",
    emoji: "🏁",
    desc: "Balapan di lintasan angka melawan bot Tarsius. Jawab benar untuk melempar dadu.",
    bankNote: "Bank bawaan 60 soal, atau pilih bank kelasmu di Bank Soal dalam game",
  },
  {
    slug: "ludo-angka",
    name: "Ludo Angka",
    emoji: "🎲",
    desc: "Ludo melawan bot Tarsius. Jawab soal dengan benar untuk menjalankan pionmu.",
    bankNote: "Bank bawaan 60 soal, atau pilih bank kelasmu di Bank Soal dalam game",
  },
  {
    slug: "ketapel-buah",
    name: "Ketapel Buah",
    emoji: "🍎",
    desc: "Tarik ketapel dan tembak buah yang membawa jawaban benar.",
    bankNote: "Bank bawaan 42 soal, atau pilih bank kelasmu di Bank Soal dalam game",
  },
  {
    slug: "ketapel-burung",
    name: "Ketapel Burung",
    emoji: "🐦",
    desc: "Tembak burung yang membawa papan jawaban benar sebelum ia terbang jauh.",
    bankNote: "Bank bawaan 42 soal, atau pilih bank kelasmu di Bank Soal dalam game",
  },
];

export function studentGameName(slug: string): string {
  return STUDENT_GAMES.find((g) => g.slug === slug)?.name ?? slug;
}
