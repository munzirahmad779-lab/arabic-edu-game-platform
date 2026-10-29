-- 0072_calculate_question_score.sql
-- Perbaikan: public.calculate_question_score(text, integer, boolean) DIPANGGIL oleh
-- submit_game_answer sejak 0061 (dipertahankan di 0062, 0063, 0064) tetapi TIDAK
-- PERNAH didefinisikan di migrasi mana pun. Di PostgreSQL, badan PL/pgSQL tidak
-- divalidasi saat CREATE FUNCTION, jadi kegagalan baru muncul saat runtime:
-- setiap submit_game_answer mengangkat 42883 (undefined_function) dan jawaban
-- siswa tidak pernah tercatat lewat jalur RPC otoritatif.
--
-- Semantik yang dipulihkan adalah semantik yang konsisten dengan sistem skor
-- yang tidak berubah sejak 0029:
-- - submissions.score_awarded menyimpan BOBOT soal (game_weight_for_difficulty:
--   easy 1, medium 2, hard 3) bila jawaban benar, 0 bila salah.
-- - get_room_leaderboard_student (0029) menjumlahkan score_awarded sebagai
--   weighted_correct dan menormalkannya terhadap game_total_weight menjadi
--   komponen akurasi 80 poin; bonus kecepatan (<= 20) dihitung leaderboard dari
--   rata-rata response_time_ms, BUKAN dari fungsi ini.
-- Mengembalikan nilai lain (mis. skala 100) akan merusak normalisasi leaderboard.

create or replace function public.calculate_question_score(
  p_difficulty text,
  p_response_time_ms integer,
  p_is_correct boolean
)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_is_correct, false)
      then public.game_weight_for_difficulty(coalesce(p_difficulty, 'easy'))
    else 0
  end;
$$;

revoke all on function public.calculate_question_score(text, integer, boolean) from public;
grant execute on function public.calculate_question_score(text, integer, boolean) to anon, authenticated;
