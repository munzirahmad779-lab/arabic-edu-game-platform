-- ============================================================================
-- 0089_rls_sesi_dan_login_attempts.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026 lewat
-- SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: relrowsecurity kedua tabel true, policy
-- student_sessions_teacher_read ada, grant authenticated pada
-- login_attempts tersisa 0.
-- Temuan baru dari introspeksi produksi 10 Nov 2026 (lihat berkas
-- tangkapan 0088), di luar daftar audit awal:
-- 1. public.student_sessions: RLS nonaktif dan role authenticated TIDAK
--    mempunyai grant apa pun atas tabel ini. Akibat yang sudah berjalan:
--    kueri hitungan login "Siswa Belajar Minggu Ini" di
--    src/app/dashboard/page.tsx:200 memakai klien terautentikasi biasa,
--    jadi kueri itu ditolak izinnya dan panelnya selalu kosong. Fungsi
--    sesi (SECURITY DEFINER) tidak terpengaruh karena berjalan sebagai
--    pemilik.
-- 2. public.login_attempts: RLS nonaktif TETAPI authenticated memegang
--    grant penuh. Guru mana pun yang login dapat membaca dan MENGHAPUS
--    seluruh catatan percobaan login lewat REST, termasuk menghapus
--    bukti percobaan gagal yang menjadi dasar kunci 1 menit pada
--    student_login. Tidak ada pemakaian langsung tabel ini di src/
--    (terverifikasi grep); satu-satunya penulisnya adalah student_login
--    (SECURITY DEFINER).
--
-- Isi perubahan:
-- - student_sessions: RLS diaktifkan; grant SELECT untuk authenticated;
--   satu policy SELECT bagi guru pemilik kelas siswanya (rantai
--   kepemilikan yang sama seperti policy class_materials produksi).
--   Panel dashboard mulai membaca data aslinya, terbatas pada siswa
--   kelas guru itu sendiri.
-- - login_attempts: RLS diaktifkan tanpa policy (hanya fungsi
--   SECURITY DEFINER dan service role yang dapat menyentuhnya) dan
--   grant authenticated dicabut.
--
-- Risiko: rendah. Kedua perubahan tidak menyentuh jalur fungsi sesi.
-- Rollback: drop policy student_sessions_teacher_read; revoke select on
-- student_sessions from authenticated; alter table student_sessions
-- disable row level security; alter table login_attempts disable row
-- level security; grant all on login_attempts to authenticated.
-- ============================================================================

alter table public.student_sessions enable row level security;

grant select on public.student_sessions to authenticated;

drop policy if exists student_sessions_teacher_read on public.student_sessions;
create policy student_sessions_teacher_read on public.student_sessions
  for select to authenticated
  using (exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = student_sessions.student_id
      and c.teacher_id = (select auth.uid())
  ));

alter table public.login_attempts enable row level security;

revoke all on public.login_attempts from authenticated;
revoke all on public.login_attempts from anon;
