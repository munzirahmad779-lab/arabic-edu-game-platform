-- 0110: perbaikan hitungan peserta laporan sesi proyektor.
-- STATUS: MENUNGGU persetujuan pemilik per berkas. Sebelum diterapkan,
-- definisi live list_room_sessions wajib diekspor ulang dan dibandingkan
-- dengan dasar di bawah ini (pelajaran drift 0102/0103), karena berkas
-- migrasi repo pernah terbukti basi terhadap produksi.
--
-- Masalah: saveProjectorReport menulis baris kolektif tim DAN baris
-- perorangan ke room_session_participants. list_room_sessions menghitung
-- semua baris sebagai participant_count, jadi sesi 4 tim x 4 siswa
-- terbaca 20 peserta padahal siswanya 16.
--
-- Perbaikan: kolom penanda is_team pada baris peserta; baris kolektif
-- tim ditandai true oleh kode (perubahan menyertai di
-- src/lib/projector-save-report.ts, diterapkan bersama migrasi ini),
-- dan participant_count hanya menghitung baris perorangan.
-- Baris lama bawaan default false agar hitungan sesi room biasa
-- (yang tidak punya baris tim) tidak berubah.

alter table public.room_session_participants
  add column if not exists is_team boolean not null default false;

create or replace function public.list_room_sessions(p_room_id uuid)
returns table (
  session_id uuid,
  session_number int,
  started_at timestamptz,
  ended_at timestamptz,
  participant_count int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    rs.id,
    rs.session_number,
    rs.started_at,
    rs.ended_at,
    (select count(*)::int from public.room_session_participants rsp
      where rsp.session_id = rs.id
        and rsp.is_team = false)
  from public.room_sessions rs
  where rs.room_id = p_room_id
  order by rs.session_number desc;
end;
$$;

revoke all on function public.list_room_sessions(uuid) from public;
grant execute on function public.list_room_sessions(uuid) to authenticated;
