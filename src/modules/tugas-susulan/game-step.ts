// Konfigurasi langkah game (Langkah 4) pada Tugas Susulan.
//
// Permainan solo bisa dibuka siswa dari akunnya sendiri lewat rute
// /student/play/<slug>. Langkah game memakai Space War versi siswa:
// siswa memainkannya sendirian (mode SOLO dipaksakan di mode siswa),
// dan penyelesaiannya tidak dikonfirmasi tombol. RPC
// student_get_catchup_tasks menghitung langkah ini selesai bila ada
// baris student_game_results milik siswa itu untuk game_slug
// 'space-war', dan hasilnya tetap tercatat di server.
//
// Keputusan pemilik (17 Nov 2026): langkah game TIDAK LAGI WAJIB.
// Sejak migrasi 0117, status 'lulus' hanya mensyaratkan baca +
// kosakata + qawaid tuntas dan latihan lulus; teacher_catchup_overview
// sejalan. Karena itu required = false: kartu tugas memberi label
// "tidak wajib" pada langkah ini, tetapi permainan tetap bisa dibuka
// dan hasilnya tetap tercatat.
export const GAME_STEP: {
  name: string;
  url: string | null;
  required: boolean;
} = {
  name: "Space War",
  url: "/student/play/space-war",
  required: false,
};
