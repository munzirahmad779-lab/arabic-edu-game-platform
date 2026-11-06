/**
 * Pesan spanduk galat untuk halaman pengelolaan permainan.
 *
 * Aksi server mengalihkan kembali dengan kode pada parameter
 * ?error=<kode>. Selama ini halaman menampilkan kode mentah itu
 * (misalnya "invalid") sehingga guru tidak tahu apa yang salah.
 * Fungsi ini menerjemahkan kode menjadi kalimat spesifik; parameter
 * ?msg= dari aksi tetap ditampilkan sebagai rincian di bawahnya
 * bila isinya bukan pengulangan pesannya sendiri.
 */

const GAME_ERROR_MESSAGES: Record<string, string> = {
  invalid:
    "Data permainan tidak lengkap atau tidak sah. Periksa kembali nama, kelas, mode permainan, dan durasi.",
  invalid_name:
    "Nama permainan wajib diisi dan tidak boleh lebih dari 120 karakter.",
  invalid_duration:
    "Durasi permainan tidak sah. Isi antara 1 sampai 60 menit.",
  no_questions:
    "Permainan belum memiliki soal. Pilih minimal 1 soal dari bank soal sebelum menyimpan.",
  too_many_questions:
    "Soal yang dipilih terlalu banyak. Maksimal 140 soal untuk satu permainan.",
  invalid_embed_url:
    "URL embed web game tidak sah. Gunakan URL lengkap berawalan https:// dari penyedia web game.",
  invalid_class:
    "Kelas yang dipilih tidak ditemukan atau bukan milik akun Anda.",
  invalid_questions:
    "Ada soal yang tidak ditemukan atau sudah dihapus. Muat ulang halaman lalu pilih kembali soalnya.",
  invalid_options:
    "Setiap soal untuk room harus memiliki pilihan A, B, C, dan D yang terisi.",
  invalid_mode_for_game_type:
    "Mode permainan itu tidak didukung untuk tipe game yang dipilih.",
  invalid_mode:
    "Mode permainan ini tidak memakai room online (khusus latihan mandiri di Portal Siswa).",
  invalid_game: "Permainan tidak ditemukan atau bukan milik akun Anda.",
  game_not_found: "Permainan tidak ditemukan atau bukan milik akun Anda.",
  room_not_found: "Room tidak ditemukan atau bukan milik akun Anda.",
  create_failed: "Permainan gagal dibuat. Coba lagi beberapa saat lagi.",
  update_failed:
    "Perubahan permainan gagal disimpan. Soal lama permainan ini tidak berubah; coba lagi beberapa saat lagi.",
  delete_failed: "Permainan gagal dihapus. Coba lagi beberapa saat lagi.",
  client_failed:
    "Koneksi ke server gagal disiapkan. Muat ulang halaman lalu coba lagi.",
};

export function getGameErrorMessage(
  code: string | undefined,
  msg?: string,
): string | null {
  if (!code) return null;
  const known = GAME_ERROR_MESSAGES[code];
  if (known) return known;
  if (msg) return msg;
  return "Terjadi kesalahan yang tidak dikenal. Coba lagi beberapa saat lagi.";
}
