# Instruksi Agen untuk Proyek Magguru LMS (magguru.web.id)

Proyek ini adalah platform LMS permainan edukasi Bahasa Arab "Magguru"
(Next.js App Router + Supabase), produksi di https://magguru.web.id,
repo github.com/munzirahmad779-lab/arabic-edu-game-platform.

## Mode kerja di proyek ini: AUDIT BACA SAJA

- Tugas agen di proyek ini adalah MENG AUDIT, bukan mengubah.
- DILARANG mengedit, membuat, memindahkan, atau menghapus berkas apa pun.
- DILARANG menjalankan perintah yang mengubah keadaan (migrasi, deploy,
  instal paket, git commit/push). Perintah baca saja (grep, cat, ls,
  tsc --noEmit bila diminta eksplisit) boleh.
- Semua temuan wajib berjangkar: sebut berkas dan nomor baris persisnya.
- Dilarang mengarang: bila sesuatu tidak bisa dibuktikan dari kode,
  tulis "belum terverifikasi dari kode" dan jelaskan cara memastikannya.
- Jangan menilai dari nama berkas saja; buka dan baca isinya.

## Cakupan mega-audit (ketetapan pemilik)

Audit menyeluruh: visual, fungsi, fitur, dan tampilan harus terbukti
bekerja semua. Wilayah periksa:

1. Autentikasi dan peran: login, logout, reset password, sesi guru/siswa,
   penjaga rute (middleware, super-admin).
2. Dashboard guru: kelas, siswa, bank soal, permainan, laporan, absensi
   dan jadwal, penilaian (assessments), pengaturan, akun.
3. Alur siswa: join room, student, practice, assessment per attemptToken,
   guest.
4. Mesin permainan dan semua game terdaftar: basket, ketapel-buah,
   ketapel-burung, sigetteng-getteng, adu-tarik-dino, banua-fruit-blast,
   kartu-hafalan, space-war, souq-fishing, games/[gameSlug].
5. Layar proyektor dan remote/controller, API projector dan rooms.
6. API routes: admin, assessments, auth, game-bank, grade-essay, health,
   question-banks, rooms.
7. Lapisan data Supabase: klien, RLS yang tersirat dari kode, migrasi di
   supabase/migrations, database doctor.
8. Kualitas kode: typecheck (tsc), pola error handling, kebocoran kredensial
   atau kunci di sisi klien, i18n dan teks Arab (RTL, harakat), aksesibilitas
   dasar, responsif HP dan desktop.

## Format laporan audit

Untuk tiap temuan: tingkat (Kritis / Mayor / Minor / Catatan), lokasi
(berkas:baris), bukti kutipan singkat, dampak bagi guru/siswa, dan saran
perbaikan yang konkret. Tutup dengan: daftar wilayah yang bersih, daftar
yang belum terverifikasi, dan urutan prioritas perbaikan.
Bahasa laporan: Bahasa Indonesia.
