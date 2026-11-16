// Konfigurasi langkah game (Langkah 4) pada Tugas Susulan.
//
// Pemeriksaan gerbang rute permainan solo di src/app/game/*/layout.tsx
// (16 Nov 2026): ludo-angka, ketapel-buah, ketapel-burung, dan
// jejak-angka SEMUA memakai gerbang sesi guru (getCurrentUser, tamu
// diarahkan ke /login). Siswa masuk dengan token sesi siswa, bukan
// sesi guru, jadi belum ada permainan solo yang bisa dibuka siswa.
//
// Karena itu nilai awal di bawah: url null dan required false. Langkah
// game tampil sebagai "menyusul" dan TIDAK menghalangi status lulus
// keseluruhan (syarat lulus di migrasi 0115 saat ini juga tanpa
// langkah game, sejalan dengan required false di sini).
//
// Cara mengaktifkan kelak: isi name dan url permainan solo yang sudah
// bisa dibuka siswa, ubah required menjadi true, lalu di migrasi
// 0115 tambahkan syarat langkah game pada status lulus RPC
// student_get_catchup_tasks (c.game_ok) dan naikkan steps_done
// menjadi 4 pada RPC teacher_catchup_overview.
export const GAME_STEP: {
  name: string;
  url: string | null;
  required: boolean;
} = {
  name: "Game Solo",
  url: null,
  required: false,
};
