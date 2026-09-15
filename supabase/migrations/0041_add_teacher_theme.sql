-- 0041_add_teacher_theme.sql
-- Simpan preferensi tema dashboard per guru.

alter table public.profiles
  add column if not exists theme text not null default 'violet';