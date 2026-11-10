-- ============================================================================
-- 0098_pulihkan_policy_select_riwayat_room.sql
-- Memulihkan policy SELECT room_sessions dan room_session_participants
-- yang hilang di produksi (temuan audit live 10 Nov 2026, tahap 34-35).
--
-- Latar (bukti katalog produksi):
-- - Migrasi 0042 membuat policy SELECT guru untuk kedua tabel ini dan
--   migrasi 0080 menambahkan policy INSERT-nya. Katalog produksi saat
--   ini hanya memuat policy INSERT (pg_policies tahap 35: tepat 2
--   baris); kedua policy SELECT dari 0042 tidak ada.
-- - saveProjectorReport menyisipkan room_sessions dengan pola
--   insert(...).select("id"), yang di PostgREST menjadi INSERT ...
--   RETURNING. Postgres menuntut baris hasil RETURNING lolos policy
--   SELECT; tanpa policy SELECT, pernyataan itu ditolak 42501
--   "new row violates row-level security policy for table
--   room_sessions" (terbukti lewat simulasi sebagai guru, tahap 35).
--   Akibatnya simpan laporan proyektor selalu berhenti di tahap sesi:
--   room terbuat, sesi dan peserta tidak pernah tertulis, dan
--   Laporan Harian tetap kosong.
--
-- Isi migrasi ini PERSIS definisi policy SELECT pada 0042 (pola
-- kepemilikan lewat room induk), idempoten (drop if exists dulu).
-- Tidak ada policy lain yang diubah; INSERT dari 0080 tetap.
--
-- Verifikasi sesudah penerapan:
-- 1. pg_policies untuk kedua tabel memuat 4 policy (2 INSERT + 2
--    SELECT).
-- 2. Simulasi insert room_sessions sebagai guru pemilik room
--    (dengan RETURNING) mengembalikan id, bukan 42501.
-- 3. Live: akhiri permainan proyektor dan simpan; sesi muncul di
--    Laporan Harian.
--
-- Rollback:
--   drop policy if exists room_sessions_teacher_select
--     on public.room_sessions;
--   drop policy if exists room_session_participants_teacher_select
--     on public.room_session_participants;
-- ============================================================================

drop policy if exists room_sessions_teacher_select on public.room_sessions;
create policy room_sessions_teacher_select on public.room_sessions
  for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.teacher_id = auth.uid()
    )
  );

drop policy if exists room_session_participants_teacher_select on public.room_session_participants;
create policy room_session_participants_teacher_select on public.room_session_participants
  for select to authenticated
  using (
    exists (
      select 1 from public.room_sessions rs
      join public.rooms r on r.id = rs.room_id
      where rs.id = session_id and r.teacher_id = auth.uid()
    )
  );
