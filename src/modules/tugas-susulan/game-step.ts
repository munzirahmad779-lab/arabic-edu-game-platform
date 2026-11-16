// Konfigurasi langkah game (Langkah 4) pada Tugas Susulan.
//
// Sejak perluasan game solo siswa (migrasi 0116), permainan solo bisa
// dibuka siswa dari akunnya sendiri lewat rute /student/play/<slug>.
// Langkah game memakai Space War versi siswa: siswa memainkannya
// sendirian (mode SOLO dipaksakan di mode siswa), dan penyelesaiannya
// TIDAK lagi dikonfirmasi tombol. RPC student_get_catchup_tasks
// menghitung langkah ini selesai bila ada baris student_game_results
// milik siswa itu untuk game_slug 'space-war', dan status 'lulus'
// mensyaratkannya; teacher_catchup_overview sejalan (syarat selesai
// tetap 4 langkah: baca, kosakata, qawaid, game).
export const GAME_STEP: {
  name: string;
  url: string | null;
  required: boolean;
} = {
  name: "Space War",
  url: "/student/play/space-war",
  required: true,
};
