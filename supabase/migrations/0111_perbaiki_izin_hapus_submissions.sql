-- ============================================================================
-- 0111_perbaiki_izin_hapus_submissions.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini).
--
-- Temuan yang ditutup:
-- - 13 Nov 2026 01:19-01:20 WITA: penghapusan permainan kelas
--   "Duel Stickman Berpedang" (Web Game Embed, kelas Mangkoso) dari
--   halaman /dashboard/games gagal dua kali dengan galat yang sama persis:
--   redirect ?error=delete_failed&msg=permission denied for table
--   submissions. Rantai hapus di src/app/dashboard/games/actions.ts:543
--   (deleteGame) berhenti pada langkah pertama rantai room:
--   delete from submissions where room_id in (rooms milik game).
-- - Game itu mempunyai room (pernah dibuka di proyektor saat verifikasi),
--   jadi rantainya tidak bisa dilewati. Permainan tanpa room tetap bisa
--   dihapus (rantai dilewati), terbukti 12 Nov 2026 saat salinan duplikat
--   permainan terhapus normal.
--
-- Hubungan dengan 0085:
-- - 0085_submissions_delete_policy.sql menutup temuan yang sama dan
--   catatan penerapannya menyatakan SUDAH DITERAPKAN ke produksi
--   (zwenvfoolgwlcjprnxlk) 10 Nov 2026 serta terverifikasi katalog
--   (policy submissions_delete_via_owned_room ada, teks qual identik
--   dengan policy SELECT lama).
-- - Perilaku produksi 13 Nov 2026 BERTENTANGAN dengan catatan itu:
--   galat "permission denied for table" adalah galat hak tingkat tabel
--   (GRANT), bukan penolakan RLS per baris. Dugaan terkuat: grant delete
--   untuk peran authenticated tidak (lagi) berlaku di produksi, apa pun
--   sebabnya; teks repo tidak bisa membuktikan keadaan katalog produksi
--   saat ini (belum terverifikasi dari kode).
-- - Berkas ini TIDAK mengubah keputusan atau cakupan 0085 sama sekali.
--   Isinya penerapan ulang yang idempoten: grant delete eksplisit +
--   policy yang sama dibuat ulang persis. Aman dijalankan walau 0085
--   ternyata sudah berlaku: hasilnya keadaan yang sama.
-- - Tidak ada migrasi sesudah 0085 yang mencabut policy atau grant ini
--   (diperiksa 0086-0110; satu-satunya revoke yang menyentuh nama serupa
--   adalah 0100 atas essay_submissions, tabel berbeda).
--
-- Verifikasi (sudah termasuk sebagai SELECT di akhir berkas ini):
-- 1. pg_policies untuk submissions memuat submissions_delete_via_owned_room
--    dengan cmd DELETE di samping policy SELECT lama.
-- 2. role_table_grants memuat DELETE untuk grantee authenticated pada
--    tabel submissions.
-- 3. Uji perilaku: hapus permainan kelas "Duel Stickman Berpedang" dari
--    /dashboard/games harus berhasil dan jumlah permainan kelas turun
--    dari 19 menjadi 18.
--
-- Rollback: sama dengan 0085.
--   drop policy if exists submissions_delete_via_owned_room
--     on public.submissions;
-- ============================================================================

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
where table_name = 'submissions' and privilege_type = 'DELETE';
