-- ============================================================================
-- 0124_rls_initplan_asesmen_dan_gabungan_room_participants.sql
-- Status: DISIAPKAN, diterapkan lewat Supabase SQL Editor pada alur yang
-- sama dengan 0119-0123 (perintah pemilik 17 Nov 2026).
--
-- Tujuan: melengkapi sisa temuan Performance Advisor yang tidak bisa
-- disiapkan dari repo pada 0121/0122 karena definisinya hanya ada di
-- produksi. Ekspresi asli diambil dari pg_policies produksi pada
-- 17 Nov 2026 (ekspor CSV kueri baca-saja), lalu ditulis ulang dengan
-- pola yang sama seperti 0121: panggilan auth.uid() dibungkus
-- (select ...) supaya dievaluasi sekali per kueri. Nama, tabel,
-- perintah, peran, dan makna ekspresi TIDAK berubah.
--
-- Sembilan kebijakan asesmen: teacher_own_assessments,
-- teacher_own_sections, teacher_own_passages, teacher_own_audio_groups,
-- teacher_own_questions, teacher_own_tokens, teacher_read_attempts,
-- teacher_read_attempt_sections, teacher_read_answers. Peran aslinya
-- {public} dipertahankan persis; kualifikasi teacher_id = auth.uid()
-- membuat kebijakan ini secara efektif hanya berlaku bagi guru yang
-- masuk, sama seperti sebelumnya.
--
-- Satu penggabungan terakhir (Multiple Permissive Policies pada
-- room_participants): kebijakan produksi room_participants_teacher_select
-- ternyata berekspresi PERSIS sama dengan
-- room_participants_select_via_owned_room yang sudah ditulis ulang di
-- 0121 (exists ruangan milik guru yang masuk). Karena keduanya SELECT
-- permisif untuk authenticated dengan ekspresi yang sama, penggabungan
-- setara makna dicapai dengan menghapus kebijakan duplikatnya saja.
-- ============================================================================

-- assessments.teacher_own_assessments (asli: for all to public, qual dan with_check (teacher_id = auth.uid()))
drop policy if exists teacher_own_assessments on public.assessments;
create policy teacher_own_assessments on public.assessments
  for all
  to public
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- assessment_sections.teacher_own_sections (asli: for all to public)
drop policy if exists teacher_own_sections on public.assessment_sections;
create policy teacher_own_sections on public.assessment_sections
  for all
  to public
  using (exists ( select 1 from public.assessments a where a.id = assessment_sections.assessment_id and a.teacher_id = (select auth.uid()) ));

-- assessment_passages.teacher_own_passages (asli: for all to public)
drop policy if exists teacher_own_passages on public.assessment_passages;
create policy teacher_own_passages on public.assessment_passages
  for all
  to public
  using (exists ( select 1 from public.assessments a where a.id = assessment_passages.assessment_id and a.teacher_id = (select auth.uid()) ));

-- assessment_audio_groups.teacher_own_audio_groups (asli: for all to public)
drop policy if exists teacher_own_audio_groups on public.assessment_audio_groups;
create policy teacher_own_audio_groups on public.assessment_audio_groups
  for all
  to public
  using (exists ( select 1 from public.assessments a where a.id = assessment_audio_groups.assessment_id and a.teacher_id = (select auth.uid()) ));

-- assessment_questions.teacher_own_questions (asli: for all to public)
drop policy if exists teacher_own_questions on public.assessment_questions;
create policy teacher_own_questions on public.assessment_questions
  for all
  to public
  using (exists ( select 1 from public.assessments a where a.id = assessment_questions.assessment_id and a.teacher_id = (select auth.uid()) ));

-- assessment_tokens.teacher_own_tokens (asli: for all to public, qual dan with_check (created_by = auth.uid()))
drop policy if exists teacher_own_tokens on public.assessment_tokens;
create policy teacher_own_tokens on public.assessment_tokens
  for all
  to public
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- assessment_attempts.teacher_read_attempts (asli: for select to public)
drop policy if exists teacher_read_attempts on public.assessment_attempts;
create policy teacher_read_attempts on public.assessment_attempts
  for select
  to public
  using (exists ( select 1 from public.assessments a where a.id = assessment_attempts.assessment_id and a.teacher_id = (select auth.uid()) ));

-- assessment_attempt_sections.teacher_read_attempt_sections (asli: for select to public)
drop policy if exists teacher_read_attempt_sections on public.assessment_attempt_sections;
create policy teacher_read_attempt_sections on public.assessment_attempt_sections
  for select
  to public
  using (exists ( select 1 from public.assessment_attempts aa join public.assessments a on a.id = aa.assessment_id where aa.id = assessment_attempt_sections.attempt_id and a.teacher_id = (select auth.uid()) ));

-- assessment_answers.teacher_read_answers (asli: for select to public)
drop policy if exists teacher_read_answers on public.assessment_answers;
create policy teacher_read_answers on public.assessment_answers
  for select
  to public
  using (exists ( select 1 from public.assessment_attempts aa join public.assessments a on a.id = aa.assessment_id where aa.id = assessment_answers.attempt_id and a.teacher_id = (select auth.uid()) ));

-- room_participants: hapus kebijakan duplikat produksi; akses yang sama
-- sudah diberikan room_participants_select_via_owned_room (0121).
drop policy if exists room_participants_teacher_select on public.room_participants;
