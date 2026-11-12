-- ============================================================================
-- 0112_grant_select_submissions_untuk_rantai_hapus.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini).
--
-- Bukti baru (13 Nov 2026, dari query katalog yang dijalankan pemilik di
-- proyek zwenvfoolgwlcjprnxlk):
-- - pg_class: submissions relrowsecurity = true, relforcerowsecurity =
--   false (RLS aktif, tidak dipaksa; keadaan normal).
-- - information_schema.role_table_grants untuk submissions memuat baris
--   DELETE bagi grantee authenticated (dan postgres). Jadi grant DELETE
--   dari 0085/0111 MEMANG berlaku di produksi; dugaan "grant hilang"
--   pada 0111 gugur.
-- - Meskipun begitu, deleteGame tetap gagal "permission denied for table
--   submissions" sesudah 0111 diterapkan (dua percobaan UI, 01:47-01:51).
--
-- Sebab yang paling konsisten dengan semua bukti:
-- - Perintah hapus aplikasi adalah DELETE ... WHERE room_id IN (...).
--   PostgreSQL mensyaratkan, di samping privilege DELETE pada tabel,
--   privilege SELECT pada kolom yang dibaca klausa WHERE (room_id).
-- - Aplikasi TIDAK PERNAH membaca submissions secara langsung dari klien
--   (grep src: satu-satunya from("submissions") adalah dua baris delete
--   di actions.ts; semua pembacaan hasil berjalan lewat RPC/fungsi),
--   konsisten dengan desain 0002 bahwa akses langsung ke submissions
--   memang ditutup. Policy SELECT submissions_select_via_owned_room
--   (0002:368) ada, tetapi policy tidak berdaya tanpa grant SELECT
--   tingkat tabel, dan tidak ada migrasi yang memberi grant itu.
-- - Berkas ini memberi grant SELECT itu. RLS tetap menjadi penapis
--   barisnya: policy SELECT yang sudah ada membatasi bacaan hanya pada
--   submissions di room milik guru yang sedang login, persis cakupan
--   policy DELETE yang disetujui pemilik 10 Nov 2026 (0085). Tidak ada
--   pelebaran akses ke data guru lain.
-- - Blok ini juga mengulang grant DELETE + pembuatan policy DELETE dari
--   0085/0111 secara idempoten, agar satu kali jalan menutup semua
--   kemungkinan sisa (mis. policy belum terbentuk).
--
-- Verifikasi (SELECT di akhir berkas):
-- 1. pg_policies submissions memuat policy SELECT lama dan
--    submissions_delete_via_owned_room (DELETE).
-- 2. role_table_grants submissions kini memuat SELECT dan DELETE untuk
--    grantee authenticated.
-- 3. Uji perilaku: hapus permainan kelas "Duel Stickman Berpedang" dari
--    /dashboard/games harus berhasil; jumlah permainan kelas 19 -> 18.
--
-- Rollback:
--   revoke select on public.submissions from authenticated;
--   (grant delete dan policy mengikuti rollback 0085.)
-- ============================================================================

grant select on public.submissions to authenticated;
grant delete on public.submissions to authenticated;

drop policy if exists submissions_delete_via_owned_room on public.submissions;
create policy submissions_delete_via_owned_room
  on public.submissions for delete
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = submissions.room_id
        and r.teacher_id = auth.uid()
    )
  );

-- Verifikasi katalog (hasilnya tampil di panel hasil SQL Editor):
select policyname, cmd, roles from pg_policies where tablename = 'submissions';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'submissions'
order by grantee, privilege_type;
