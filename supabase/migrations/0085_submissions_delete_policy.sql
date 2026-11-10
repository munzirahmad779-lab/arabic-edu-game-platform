-- ============================================================================
-- 0085_submissions_delete_policy.sql
-- Status: FINAL. Keputusan pemilik 10 Nov 2026 18:47 WITA:
-- "Bolehkan: guru pemilik room dapat menghapus submissions".
-- Catatan keputusan desain di bawah tetap menjadi riwayat
-- keputusan ini.
--
-- Temuan yang ditutup:
-- - W2-Ma10 sisi basis data (Mayor, audit wilayah 2): rantai hapus game
--   dan room di aplikasi mencoba menghapus baris submissions, tetapi
--   tabel itu tidak mempunyai policy DELETE, sehingga penghapusan
--   diam-diam mengenai 0 baris (sisi aplikasinya sudah diperbaiki di
--   gelombang 1 agar melaporkan error; tanpa policy ini langkah hapus
--   submissions-nya tetap tidak pernah berhasil).
--
-- Keadaan sekarang (terbukti dari migrasi):
-- - Satu-satunya policy pada submissions adalah SELECT untuk guru
--   pemilik room: submissions_select_via_owned_room,
--   0002_rls_policies.sql:368-377.
-- - Tidak ada grant tabel eksplisit atas submissions di migrasi mana
--   pun (grep "grant ... on public.submissions": 0 hasil); izin tingkat
--   tabel di produksi bergantung pada default privileges Supabase, yang
--   tidak tercatat di repo (belum terverifikasi dari kode). Karena itu
--   berkas ini menyertakan grant delete secara eksplisit dan defensif.
--
-- Catatan keputusan (penting):
-- - Ketidakadaan policy DELETE ini SEMULA disengaja. 0001_init_schema.
--   sql:25-26 menyatakan submissions immutable dan tidak diberi policy
--   UPDATE/DELETE untuk siapa pun; komentar bagian submissions di 0002
--   (0002:360-366, policy-nya 0002:368) menegaskan hal yang sama:
--   submissions hanya boleh ditulis RPC penilaian SECURITY DEFINER.
-- - Berkas ini membalik keputusan itu SECARA SEMPIT: hanya DELETE,
--   hanya oleh guru pemilik room induk submission (rantai yang sama
--   persis dengan policy SELECT yang ada), hanya untuk melayani rantai
--   hapus game/room milik guru itu sendiri. INSERT dan UPDATE dari
--   klien tetap tertutup; penulisan nilai tetap hanya lewat RPC.
-- - Bila pemilik menilai imutabilitas riwayat jawaban lebih penting
--   daripada rantai hapus yang tuntas, JANGAN terapkan berkas ini;
--   konsekuensinya rantai hapus game/room akan terus menyisakan baris
--   submissions (atau perlu diubah menjadi arsip, keputusan terpisah).
--
-- Isi perubahan:
-- 1. grant delete on public.submissions to authenticated (defensif,
--    idempoten; RLS tetap menjadi penapis barisnya).
-- 2. Policy submissions_delete_via_owned_room: pola exists() yang sama
--    persis dengan submissions_select_via_owned_room (0002:368-377),
--    hanya perintahnya delete.
--
-- Risiko / efek samping:
-- - Sesudah diterapkan, guru dapat menghapus submissions di room
--   miliknya lewat klien mana pun (bukan hanya lewat rantai hapus
--   aplikasi). Itu memang wewenang yang diminta Ma10, tetapi berarti
--   riwayat jawaban tidak lagi immutable terhadap pemilik room.
--   Penghapusan tetap mustahil untuk data guru lain (RLS).
--
-- Verifikasi sesudah diterapkan:
-- 1. select policyname, cmd from pg_policies
--     where tablename = 'submissions'; harus memuat
--     submissions_delete_via_owned_room dengan cmd DELETE di samping
--     policy SELECT lama.
-- 2. Uji dua akun: sebagai guru A, delete satu submissions di room
--    guru B harus mengenai 0 baris; di room sendiri harus 1 baris.
--
-- Rollback:
--   drop policy if exists submissions_delete_via_owned_room
--     on public.submissions;
--   (grant delete boleh dibiarkan; tanpa policy, RLS menolak semua
--   penghapusan dari klien.)
-- ============================================================================

-- CATATAN PENERAPAN (10 Nov 2026, tahap 22):
-- Berkas ini SUDAH DITERAPKAN ke produksi (zwenvfoolgwlcjprnxlk)
-- 10 Nov 2026 sesudah keputusan pemilik 18:47 WITA, dan diverifikasi
-- katalog: pg_policies memuat submissions_delete_via_owned_room
-- (DELETE, {authenticated}) dengan teks qual IDENTIK dengan policy
-- SELECT lama submissions_select_via_owned_room, yaitu
-- EXISTS (rooms r WHERE r.id = submissions.room_id AND
-- r.teacher_id = auth.uid()). Uji dua akun guru dari kepala berkas
-- TIDAK dijalankan (butuh dua sesi guru nyata); bukti yang dipakai
-- adalah kesamaan persis teks qual dengan policy SELECT yang sudah
-- terbukti bekerja di produksi.

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
