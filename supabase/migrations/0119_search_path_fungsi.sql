-- ============================================================================
-- 0119_search_path_fungsi.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini).
--
-- Tujuan: menutup 10 temuan Security Advisor "Function Search Path
-- Mutable" (ekspor Advisor 17 Nov 2026). Setiap fungsi di bawah belum
-- memasang search_path; pola perbaikan mengikuti pola repo yang sudah
-- benar (0115/0116): set search_path to 'public', 'extensions'.
-- ALTER FUNCTION hanya mengubah konfigurasi fungsi; badan fungsi,
-- pemilik, dan hibah tidak berubah, jadi berkas ini aman dijalankan
-- kapan pun dan tidak bergantung pada berkas 0120-0123.
--
-- Daftar fungsi dan jangkar definisinya di repo:
-- - public.set_updated_at() : 0001_init_schema.sql
-- - public.super_admin_email() : 0081_profiles_email_eskalasi.sql
-- - public.game_time_limit_for_difficulty(text) : 0029_game_scoring_v2.sql
-- - public.game_weight_for_difficulty(text) : 0029_game_scoring_v2.sql
-- - public.game_total_weight(jsonb) : 0029_game_scoring_v2.sql
-- - public.game_avg_limit_ms(jsonb) : 0029_game_scoring_v2.sql
-- - public.assessment_convert_section(text, integer) : hanya produksi; tanda tangan berjangkar 0091:97 dan pemakaian 0091:664
-- - public.souq_fishing_merge_checkpoint(uuid, jsonb) : 0065_souq_fishing_checkpoint_rpc.sql
-- - public.calculate_question_score(text, integer, boolean) : 0072_calculate_question_score.sql
-- - public.game_effective_time_limit_seconds(text, integer) : 0074_question_duration_floor_and_override.sql
-- Catatan: public.assessment_convert_section tidak terdefinisi di repo
-- (fungsi hanya ada di produksi; 0091 mencatat tanda tangannya
-- (text, int) pada baris 97 dan memakainya pada baris 664). Bila tanda
-- tangan produksi ternyata berbeda, barisnya akan gagal sendiri tanpa
-- memengaruhi baris lain; periksa lebih dulu dengan \df bila ragu.
-- ============================================================================

alter function public.set_updated_at() set search_path to 'public', 'extensions';
alter function public.super_admin_email() set search_path to 'public', 'extensions';
alter function public.game_time_limit_for_difficulty(text) set search_path to 'public', 'extensions';
alter function public.game_weight_for_difficulty(text) set search_path to 'public', 'extensions';
alter function public.game_total_weight(jsonb) set search_path to 'public', 'extensions';
alter function public.game_avg_limit_ms(jsonb) set search_path to 'public', 'extensions';
alter function public.assessment_convert_section(text, integer) set search_path to 'public', 'extensions';
alter function public.souq_fishing_merge_checkpoint(uuid, jsonb) set search_path to 'public', 'extensions';
alter function public.calculate_question_score(text, integer, boolean) set search_path to 'public', 'extensions';
alter function public.game_effective_time_limit_seconds(text, integer) set search_path to 'public', 'extensions';
