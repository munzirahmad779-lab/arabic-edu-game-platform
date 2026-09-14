-- 0033_grant_new_tables.sql
-- Grant izin akses ke tabel baru yang dibuat di migrasi 0030-0031.
-- Supabase tidak auto-grant untuk tabel baru.

grant select, insert, update, delete
  on public.teacher_audio_settings to authenticated;
grant select, insert, update, delete
  on public.teacher_audio_settings to anon;

grant select, insert, update, delete
  on public.room_sessions to authenticated;

grant select, insert, update, delete
  on public.room_session_participants to authenticated;