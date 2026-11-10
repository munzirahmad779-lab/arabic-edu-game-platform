-- ============================================================================
-- 0100_grant_service_role_esai.sql
-- Beri service_role hak SELECT pada tabel esai.
--
-- Akar masalah penilaian AI esai yang selalu menjawab "Submission
-- tidak ditemukan" (terbukti dari log API Supabase 10 Nov 2026):
-- route /api/grade-essay membaca essay_submissions +
-- essay_assignments lewat klien service_role, tetapi migrasi 0054
-- hanya memberi grant kepada authenticated. PostgREST menjawab
-- 42501 (izin ditolak) untuk service_role; route menelan error itu
-- sebagai "tidak ditemukan". service_role memang melewati RLS,
-- tetapi tetap membutuhkan grant tabel dari PostgREST.
--
-- Cakupan sengaja sempit: hanya SELECT pada dua tabel yang dibaca
-- route. Penulisan skor tetap lewat RPC SECURITY DEFINER
-- student_set_ai_grade (sudah di-grant ke service_role oleh 0084);
-- tidak ada grant INSERT/UPDATE/DELETE di berkas ini.
--
-- Verifikasi sesudah penerapan:
--   select has_table_privilege('service_role','public.essay_submissions','SELECT'),
--          has_table_privilege('service_role','public.essay_assignments','SELECT');
--   keduanya wajib true, lalu uji tombol "Nilai dengan AI" di web.
--
-- Rollback:
--   revoke select on public.essay_submissions, public.essay_assignments
--     from service_role;
-- ============================================================================

grant select on public.essay_submissions to service_role;
grant select on public.essay_assignments to service_role;
