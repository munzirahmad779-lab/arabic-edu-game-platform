-- ============================================================================
-- GELOMBANG 2 — 0080_cleanup_history_per_guru.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026
-- lewat SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: sesuai harapan (lihat INDEKS gelombang 2).
-- Status: SIAP TERAP, dengan SATU ketergantungan urutan: fungsi pembantu
-- public.is_super_admin() dibuat oleh draf 0079 (berkas
-- 0079_profiles_email_eskalasi.sql). Terapkan 0079 sebelum berkas ini
-- (lihat INDEKS.md). Menunggu persetujuan pemilik per berkas.
--
-- CATATAN PENOMORAN: nomor 0080 SUDAH dipakai migrasi asli
-- 0080_projector_report_insert_policies.sql. Bila berkas ini dipindah ke
-- supabase/migrations, nomornya WAJIB diganti mengikuti INDEKS.md (0082).
--
-- Temuan yang ditutup:
-- - W2-K1 (Kritis, audit wilayah 2): tombol cleanup di halaman laporan
--   dapat menghapus riwayat SEMUA guru.
--
-- Objek yang diubah:
-- - public.cleanup_old_history() — satu-satunya definisi ada di
--   0047_history_cleanup_and_reports.sql:5-39 (grep seluruh migrasi:
--   tepat 1 definisi, tidak ada penimpa sesudah 0047). Badannya hanya
--   memeriksa auth.uid() is null (0047:15-17), lalu menghapus tanpa
--   filter guru:
--   - room_session_participants dari sesi > 7 hari (0047:19-25),
--   - room_sessions > 7 hari (0047:27-29),
--   - student_practice_answers > 7 hari (0047:31-34).
--   Grant di 0047:111-112: execute untuk authenticated, jadi guru mana
--   pun yang login dapat memanggilnya; pemanggil UI-nya
--   src/app/dashboard/reports/report-view.tsx:159 (audit wilayah 2).
--
-- Isi perubahan:
-- - Tanda tangan, nilai kembali (int = total baris terhapus), ambang
--   7 hari, dan grant dipertahankan persis.
-- - Setiap penghapusan kini dibatasi pada data milik guru pemanggil
--   (auth.uid()), mengikuti rantai kepemilikan yang sudah dipakai
--   teacher_daily_report di berkas yang sama:
--   - room_sessions lewat room induk: rooms.teacher_id (0047:84-85, 90),
--   - student_practice_answers lewat siswa dan kelasnya:
--     students.class_id -> classes.teacher_id (0047:104-109).
-- - Pengecualian: pemanggil super-admin (public.is_super_admin(),
--   berbasis email JWT) tetap membersihkan seluruh riwayat kedaluwarsa,
--   mempertahankan kegunaan pemeliharaan global yang lama.
--
-- Risiko / efek samping:
-- - Guru biasa tidak lagi membersihkan riwayat guru lain (itu intinya);
--   perilaku dari sisi UI tidak berubah selain cakupan datanya.
-- - Baris yatim tidak ikut terhapus oleh guru: sesi room yang baris
--   rooms induknya sudah tidak ada tidak lolos saringan kepemilikan,
--   dan jawaban latihan yang siswanya sudah terhapus juga tidak.
--   Keduanya tetap dibersihkan saat super-admin menjalankan cleanup.
--   Ini arah yang aman (gagal menyempit, bukan melebar).
-- - Bila draf 0079 belum diterapkan, create or replace di berkas ini
--   tetap berhasil (pemanggilan is_super_admin terjadi saat fungsi
--   dijalankan, bukan saat dibuat), tetapi setiap pemanggilan cleanup
--   akan gagal dengan galat fungsi tidak ditemukan. Karena itu urutan
--   penerapan di INDEKS.md wajib diikuti.
--
-- Verifikasi sesudah diterapkan:
-- 1. pg_get_functiondef(oid) untuk cleanup_old_history memuat
--    'is_super_admin' dan 'teacher_id'.
-- 2. Uji dua akun (cara yang disarankan audit wilayah 2): buat data
--    riwayat uji berusia > 7 hari milik guru A; panggil
--    cleanup_old_history() sebagai guru B; data guru A harus UTUH dan
--    total kembali hanya menghitung data guru B. Panggil sebagai
--    pemilik (super-admin): data uji guru A ikut terhapus.
--
-- Rollback: terapkan ulang definisi dari 0047:5-39 beserta grant
-- 0047:111-112.
-- ============================================================================

create or replace function public.cleanup_old_history()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_total int := 0;
  v_n int;
  v_uid uuid;
  v_all boolean;
  v_cutoff timestamptz := now() - interval '7 days';
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Super-admin (email JWT, lihat draf 0079) membersihkan semuanya;
  -- guru biasa hanya riwayat miliknya sendiri.
  v_all := public.is_super_admin();

  -- 1. Peserta dari sesi room lama (0047:19-25 + saringan pemilik room)
  delete from public.room_session_participants rsp
  where rsp.session_id in (
    select rs.id
    from public.room_sessions rs
    join public.rooms r on r.id = rs.room_id
    where rs.created_at < v_cutoff
      and (v_all or r.teacher_id = v_uid)
  );
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  -- 2. Sesi room lama (0047:27-29 + saringan pemilik room)
  delete from public.room_sessions rs
  where rs.created_at < v_cutoff
    and (v_all or exists (
      select 1 from public.rooms r
      where r.id = rs.room_id
        and r.teacher_id = v_uid
    ));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  -- 3. Jawaban latihan lama (0047:31-34 + saringan pemilik kelas siswa)
  delete from public.student_practice_answers spa
  where spa.answered_at < v_cutoff
    and (v_all or exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = spa.student_id
        and c.teacher_id = v_uid
    ));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;

revoke all on function public.cleanup_old_history() from public;
grant execute on function public.cleanup_old_history() to authenticated;
