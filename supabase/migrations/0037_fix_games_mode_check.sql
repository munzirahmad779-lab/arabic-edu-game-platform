-- 0037_fix_games_mode_check.sql
-- Hapus CHECK constraint lama pada kolom `mode` di tabel `games`,
-- lalu buat yang baru yang mencakup semua mode yang diizinkan.

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_mode_check;

ALTER TABLE public.games
  ADD CONSTRAINT games_mode_check
  CHECK (mode IN ('competitive', 'cooperative', 'endless', 'practice', 'learning'));