-- ============================================================================
-- 0092_ketatkan_policy_anon_asesmen.sql
-- Status: DITERAPKAN ke produksi 10 Nov 2026 (16:53-16:56 WITA) lewat
-- SQL Editor oleh Muse atas perintah pemilik, sesudah ketiga syarat
-- di bawah terbukti; verifikasi katalog: 11 policy anon hilang, tersisa
-- hanya 9 policy guru. Probe pasca-penerapan dengan kunci anon: baca
-- tabel langsung mengembalikan kosong, sisip jawaban ditolak 42501,
-- dan alur RPC penuh (mulai -> payload -> jawab -> selesai -> hasil)
-- tetap LULUS ujung-ke-ujung.
-- SYARAT PENERAPAN (ketiganya wajib sudah terbukti sebelum berkas ini
-- dijalankan): (1) migrasi 0091 dan 0093 sudah terpasang di produksi;
-- (2) aplikasi hasil gabungan 5e47a44 (player + halaman masuk + halaman
-- hasil murni RPC) sudah live; (3) uji ujung-ke-ujung dengan data uji
-- (mulai attempt -> ambil payload -> kirim jawaban -> selesai -> baca
-- hasil, semuanya lewat RPC dengan kunci anon) sudah LULUS.
--
-- Temuan yang ditutup: sisa W3-K3 mega-audit di tingkat policy. Teks
-- qual policy anon produksi terverifikasi dari pg_policies (ekspor
-- 10 Nov 2026 tahap 9-10): assessment_answers dan
-- assessment_attempt_sections memberi ALL dengan qual true;
-- assessment_attempts memberi INSERT/SELECT/UPDATE dengan qual true;
-- assessment_questions, assessment_sections, assessment_passages,
-- assessment_audio_groups memberi SELECT dengan qual true;
-- assessment_tokens memberi SELECT dengan qual (is_active = true);
-- assessments memberi SELECT dengan qual (is_published = true).
-- Dengan kunci anon publik, siapa pun dapat membaca kunci jawaban
-- semua soal, membaca/mengubah/menghapus jawaban dan attempt
-- (termasuk kolom skor), serta mendaftar token kelas aktif.
--
-- Isi: menghapus SEBELAS policy anon itu. RLS tetap aktif di semua
-- tabel; policy guru (teacher_*, terlingkup teacher_id/created_by =
-- auth.uid()) tidak disentuh. Alur siswa berjalan lewat fungsi
-- SECURITY DEFINER 0091/0093 yang tidak tunduk pada policy ini.
-- Sensus pembaca di src/ (10 Nov 2026) membuktikan tidak ada lagi
-- pembaca anon yang sah atas kesembilan tabel assessment_* sesudah
-- aplikasi baru live.
--
-- ROLLBACK (tempel untuk mengembalikan keadaan persis sebelumnya):
-- create policy anon_all_answers on public.assessment_answers
--   for all to anon using (true) with check (true);
-- create policy anon_all_attempt_sections
--   on public.assessment_attempt_sections
--   for all to anon using (true) with check (true);
-- create policy anon_insert_attempts on public.assessment_attempts
--   for insert to anon with check (true);
-- create policy anon_read_attempts on public.assessment_attempts
--   for select to anon using (true);
-- create policy anon_update_attempts on public.assessment_attempts
--   for update to anon using (true) with check (true);
-- create policy anon_read_questions on public.assessment_questions
--   for select to anon using (true);
-- create policy anon_read_sections on public.assessment_sections
--   for select to anon using (true);
-- create policy anon_read_passages on public.assessment_passages
--   for select to anon using (true);
-- create policy anon_read_audio_groups
--   on public.assessment_audio_groups
--   for select to anon using (true);
-- create policy anon_read_tokens on public.assessment_tokens
--   for select to anon using (is_active = true);
-- create policy anon_read_assessment on public.assessments
--   for select to anon using (is_published = true);
--
-- Verifikasi sesudah penerapan:
-- select tablename, policyname from pg_policies where schemaname =
-- 'public' and tablename like 'assessment%' order by 1,2;
-- (harus tersisa hanya policy teacher_* dan essay_*; tidak ada lagi
-- nama berawalan anon_ di tabel assessment_*)
-- ============================================================================

drop policy if exists anon_all_answers on public.assessment_answers;
drop policy if exists anon_all_attempt_sections
  on public.assessment_attempt_sections;
drop policy if exists anon_insert_attempts on public.assessment_attempts;
drop policy if exists anon_read_attempts on public.assessment_attempts;
drop policy if exists anon_update_attempts on public.assessment_attempts;
drop policy if exists anon_read_questions on public.assessment_questions;
drop policy if exists anon_read_sections on public.assessment_sections;
drop policy if exists anon_read_passages on public.assessment_passages;
drop policy if exists anon_read_audio_groups
  on public.assessment_audio_groups;
drop policy if exists anon_read_tokens on public.assessment_tokens;
drop policy if exists anon_read_assessment on public.assessments;
