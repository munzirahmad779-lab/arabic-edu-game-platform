-- 0035_game_modes_and_backsound.sql
-- 1. Tambah kolom backsound_track_id di games (FK ke teacher_audio_tracks).
-- Catatan: kolom `mode` bertipe text, jadi mode baru
-- (cooperative, endless, practice) bisa langsung dipakai tanpa alter type.

alter table public.games
  add column if not exists backsound_track_id uuid
  references public.teacher_audio_tracks(id) on delete set null;

create index if not exists games_backsound_track_id_idx
  on public.games (backsound_track_id);