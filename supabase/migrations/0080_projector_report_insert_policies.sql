-- =====================================================================
-- MIGRASI 0080 - SUDAH DITERAPKAN KE PRODUKSI
-- Diterapkan langsung oleh user lewat SQL Editor Supabase proyek
-- Magguru pada Jumat pagi 6 Nov 2026, hasilnya sukses (kata user:
-- "sql pun udah sukses tadi"). Berkas ini adalah catatan repo atas
-- perubahan yang sudah berjalan di produksi, disimpan dari draf
-- ~/workspace/magguru-lms/draf-migrasi-0080-laporan-proyektor.sql
-- dengan isi SQL yang persis sama.
--
-- Tujuan: membuka policy INSERT untuk room_sessions dan
-- room_session_participants bagi guru pemilik room induknya, supaya
-- POST /api/projector/save-report (penyimpanan laporan permainan
-- proyektor) bisa menulis riwayat permainan.
--
-- Latar (terbukti dari migrasi repo + audit live 5-6 Nov 2026):
-- - 0030 mengaktifkan RLS pada kedua tabel tanpa policy apa pun;
--   penulisan riwayat room selama ini hanya lewat RPC SECURITY
--   DEFINER archive_room_session.
-- - 0033 memberi grant insert ke authenticated (izin tingkat tabel).
-- - 0042 hanya membuat policy FOR SELECT pada kedua tabel.
-- - Tanpa policy INSERT, Postgres menolak insert dari klien RLS
--   (endpoint memakai klien sesi guru) dengan galat 42501
--   "new row violates row-level security policy", sehingga laporan
--   permainan room maupun hotseat dari proyektor selalu gagal
--   tersimpan pada tahap pembuatan sesi.
--
-- Bentuk policy meniru persis pola policy SELECT di 0042 (kepemilikan
-- diperiksa lewat room induk). Hanya INSERT yang dibuka; SELECT,
-- UPDATE, DELETE tidak berubah. Idempoten (drop if exists dulu).
--
-- Cara menerapkan (sudah dilakukan, dicatat untuk riwayat):
-- tempel SELURUH isi berkas ini ke SQL Editor Supabase proyek
-- Magguru, jalankan sekali.
--
-- Rollback bila perlu:
--   drop policy if exists room_sessions_teacher_insert on public.room_sessions;
--   drop policy if exists room_session_participants_teacher_insert on public.room_session_participants;
-- =====================================================================

drop policy if exists room_sessions_teacher_insert on public.room_sessions;
create policy room_sessions_teacher_insert on public.room_sessions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.teacher_id = auth.uid()
    )
  );

drop policy if exists room_session_participants_teacher_insert on public.room_session_participants;
create policy room_session_participants_teacher_insert on public.room_session_participants
  for insert to authenticated
  with check (
    exists (
      select 1 from public.room_sessions rs
      join public.rooms r on r.id = rs.room_id
      where rs.id = session_id and r.teacher_id = auth.uid()
    )
  );
