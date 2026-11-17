// Konfigurasi langkah kosakata dan qawaid (Langkah 2) pada Tugas
// Susulan.
//
// Keputusan FINAL pemilik (17 Nov 2026): langkah WAJIB Tugas Susulan
// tinggal 2, yaitu Baca Materi (Langkah 1) dan Latihan soal dars itu
// sendiri (Langkah 3). Kosakata dan Qawaid, sama seperti langkah
// Game (lihat game-step.ts), TIDAK wajib: keduanya tetap tampil di
// kartu tugas, tetap bisa dibuka sesudah Baca selesai, dan
// penyelesaiannya tetap tercatat di server dengan timer 10 menit
// dan gerbang 7 menit seperti sebelumnya.
//
// Sejak migrasi 0118, status 'lulus' pada RPC
// student_get_catchup_tasks hanya mensyaratkan baca selesai dan
// latihan lulus; bukti kosakata dan qawaid tetap dihitung dan tetap
// memicu status 'proses', tetapi tidak menentukan lulus. Karena itu
// required = false untuk kedua langkah ini: kartu tugas memberi
// label "tidak wajib" pada masing-masing langkah.
export const KOSAKATA_STEP: { required: boolean } = { required: false };
export const QAWAID_STEP: { required: boolean } = { required: false };
