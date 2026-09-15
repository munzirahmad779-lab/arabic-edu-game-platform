-- 0044_grant_students.sql
-- Beri izin UPDATE untuk sinkronisasi pin_plain di tabel students.

grant update (pin_plain) on public.students to authenticated;