// Nama game tersimpan dapat membawa token internal [THEME:<mesin>] atau
// [EMBED:<url>] yang dipakai mesin untuk mengenali tema/embed. Token itu
// bukan untuk mata pengguna: semua titik tampil (siswa, guru, laporan,
// ekspor) wajib membersihkannya lewat helper ini. Nama tersimpan sendiri
// TIDAK diubah; resolusi tipe di server tetap membaca token dari nama.
export function displayGameName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s*\[(THEME|EMBED):[^\]]*\]/gi, "").trim();
}
