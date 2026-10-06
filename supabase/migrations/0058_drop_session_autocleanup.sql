-- 0058_drop_session_autocleanup.sql
-- Drop trigger auto-hapus session lama saat login (user mau manual).

drop trigger if exists trg_cleanup_sessions_on_login on public.student_sessions;
drop function if exists public.cleanup_sessions_on_login();