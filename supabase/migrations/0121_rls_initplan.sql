-- ============================================================================
-- 0121_rls_initplan.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini). Jalankan SEBELUM
-- 0122 (satu kebijakan anggota gabungan sengaja ditangani di 0122).
--
-- Tujuan: menutup temuan Performance Advisor "Auth RLS Initialization
-- Plan" (ekspor Advisor 17 Nov 2026: 56 kebijakan). Pola perbaikan
-- persis saran Supabase: panggilan auth.<fungsi>() dan current_setting()
-- di dalam ekspresi policy dibungkus menjadi (select ...) supaya
-- dievaluasi sekali per kueri, bukan sekali per baris. Makna policy
-- TIDAK berubah: nama, tabel, perintah, peran, dan ekspresi sama;
-- hanya pembungkus pemanggilan fungsinya yang ditambah.
--
-- Berkas ini menulis ulang 46 kebijakan yang definisinya
-- ditemukan utuh di migrasi repo. Satu kebijakan anggota daftar
-- (questions_select_own) tidak ditulis di sini karena digabungkan di
-- 0122 dengan ekspresi yang sudah terbungkus. Sembilan kebijakan
-- asesmen (teacher_own_* pada assessments, assessment_sections,
-- assessment_questions, assessment_passages, assessment_audio_groups,
-- assessment_tokens, dan teacher_read_* pada assessment_attempts,
-- assessment_attempt_sections, assessment_answers) TIDAK ditemukan
-- definisinya di repo (hanya nama/perintah/peran yang tercatat di
-- tangkapan 0090 baris 99-113); ekspresinya tidak ditebak, jadi tidak
-- ditulis ulang di sini. Ambil ekspresi aslinya lebih dulu dengan
-- kueri pada komentar di akhir berkas ini bila ingin melengkapinya.
-- ============================================================================

-- classes.classes_delete_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists classes_delete_own on public.classes;
create policy classes_delete_own on public.classes
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- classes.classes_insert_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists classes_insert_own on public.classes;
create policy classes_insert_own on public.classes
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

-- classes.classes_select_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists classes_select_own on public.classes;
create policy classes_select_own on public.classes
  for select
  to authenticated
  using (teacher_id = (select auth.uid()));

-- classes.classes_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists classes_update_own on public.classes;
create policy classes_update_own on public.classes
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- essay_assignments.essay_assignments_teacher_all (definisi terakhir: 0054_essay.sql)
drop policy if exists essay_assignments_teacher_all on public.essay_assignments;
create policy essay_assignments_teacher_all on public.essay_assignments
  for all
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- essay_submissions.essay_submissions_teacher_all (definisi terakhir: 0054_essay.sql)
drop policy if exists essay_submissions_teacher_all on public.essay_submissions;
create policy essay_submissions_teacher_all on public.essay_submissions
  for all
  to authenticated
  using (exists ( select 1 from public.essay_assignments ea where ea.id = assignment_id and ea.teacher_id = (select auth.uid()) ))
  with check (exists ( select 1 from public.essay_assignments ea where ea.id = assignment_id and ea.teacher_id = (select auth.uid()) ));

-- game_questions.game_questions_delete_via_owned_game (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists game_questions_delete_via_owned_game on public.game_questions;
create policy game_questions_delete_via_owned_game on public.game_questions
  for delete
  to authenticated
  using (exists ( select 1 from public.games g where g.id = game_questions.game_id and g.teacher_id = (select auth.uid()) ));

-- game_questions.game_questions_insert_via_owned_game (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists game_questions_insert_via_owned_game on public.game_questions;
create policy game_questions_insert_via_owned_game on public.game_questions
  for insert
  to authenticated
  with check (exists ( select 1 from public.games g where g.id = game_questions.game_id and g.teacher_id = (select auth.uid()) ));

-- game_questions.game_questions_select_via_owned_game (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists game_questions_select_via_owned_game on public.game_questions;
create policy game_questions_select_via_owned_game on public.game_questions
  for select
  to authenticated
  using (exists ( select 1 from public.games g where g.id = game_questions.game_id and g.teacher_id = (select auth.uid()) ));

-- game_questions.game_questions_update_via_owned_game (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists game_questions_update_via_owned_game on public.game_questions;
create policy game_questions_update_via_owned_game on public.game_questions
  for update
  to authenticated
  using (exists ( select 1 from public.games g where g.id = game_questions.game_id and g.teacher_id = (select auth.uid()) ))
  with check (exists ( select 1 from public.games g where g.id = game_questions.game_id and g.teacher_id = (select auth.uid()) ));

-- games.games_delete_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists games_delete_own on public.games;
create policy games_delete_own on public.games
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- games.games_insert_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists games_insert_own on public.games;
create policy games_insert_own on public.games
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

-- games.games_select_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists games_select_own on public.games;
create policy games_select_own on public.games
  for select
  to authenticated
  using (teacher_id = (select auth.uid()));

-- games.games_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists games_update_own on public.games;
create policy games_update_own on public.games
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- profiles.profiles_select_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- profiles.profiles_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- question_categories.question_categories_delete_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists question_categories_delete_own on public.question_categories;
create policy question_categories_delete_own on public.question_categories
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- question_categories.question_categories_insert_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists question_categories_insert_own on public.question_categories;
create policy question_categories_insert_own on public.question_categories
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

-- question_categories.question_categories_select_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists question_categories_select_own on public.question_categories;
create policy question_categories_select_own on public.question_categories
  for select
  to authenticated
  using (teacher_id = (select auth.uid()));

-- question_categories.question_categories_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists question_categories_update_own on public.question_categories;
create policy question_categories_update_own on public.question_categories
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- questions.questions_delete_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists questions_delete_own on public.questions;
create policy questions_delete_own on public.questions
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- questions.questions_insert_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists questions_insert_own on public.questions;
create policy questions_insert_own on public.questions
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

-- questions.questions_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists questions_update_own on public.questions;
create policy questions_update_own on public.questions
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- room_participants.room_participants_delete_via_owned_room (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists room_participants_delete_via_owned_room on public.room_participants;
create policy room_participants_delete_via_owned_room on public.room_participants
  for delete
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = room_participants.room_id and r.teacher_id = (select auth.uid()) ));

-- room_participants.room_participants_insert_via_owned_room (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists room_participants_insert_via_owned_room on public.room_participants;
create policy room_participants_insert_via_owned_room on public.room_participants
  for insert
  to authenticated
  with check (exists ( select 1 from public.rooms r where r.id = room_participants.room_id and r.teacher_id = (select auth.uid()) ));

-- room_participants.room_participants_select_via_owned_room (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists room_participants_select_via_owned_room on public.room_participants;
create policy room_participants_select_via_owned_room on public.room_participants
  for select
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = room_participants.room_id and r.teacher_id = (select auth.uid()) ));

-- room_participants.room_participants_update_via_owned_room (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists room_participants_update_via_owned_room on public.room_participants;
create policy room_participants_update_via_owned_room on public.room_participants
  for update
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = room_participants.room_id and r.teacher_id = (select auth.uid()) ))
  with check (exists ( select 1 from public.rooms r where r.id = room_participants.room_id and r.teacher_id = (select auth.uid()) ));

-- room_session_participants.room_session_participants_teacher_insert (definisi terakhir: 0080_projector_report_insert_policies.sql)
drop policy if exists room_session_participants_teacher_insert on public.room_session_participants;
create policy room_session_participants_teacher_insert on public.room_session_participants
  for insert
  to authenticated
  with check (exists ( select 1 from public.room_sessions rs join public.rooms r on r.id = rs.room_id where rs.id = session_id and r.teacher_id = (select auth.uid()) ));

-- room_session_participants.room_session_participants_teacher_select (definisi terakhir: 0098_pulihkan_policy_select_riwayat_room.sql)
drop policy if exists room_session_participants_teacher_select on public.room_session_participants;
create policy room_session_participants_teacher_select on public.room_session_participants
  for select
  to authenticated
  using (exists ( select 1 from public.room_sessions rs join public.rooms r on r.id = rs.room_id where rs.id = session_id and r.teacher_id = (select auth.uid()) ));

-- room_session_question_stats.rsqs_teacher_select (definisi terakhir: 0052_room_answer_review.sql)
drop policy if exists rsqs_teacher_select on public.room_session_question_stats;
create policy rsqs_teacher_select on public.room_session_question_stats
  for select
  to authenticated
  using (exists ( select 1 from public.room_sessions rs join public.rooms r on r.id = rs.room_id where rs.id = session_id and r.teacher_id = (select auth.uid()) ));

-- room_sessions.room_sessions_teacher_insert (definisi terakhir: 0080_projector_report_insert_policies.sql)
drop policy if exists room_sessions_teacher_insert on public.room_sessions;
create policy room_sessions_teacher_insert on public.room_sessions
  for insert
  to authenticated
  with check (exists ( select 1 from public.rooms r where r.id = room_id and r.teacher_id = (select auth.uid()) ));

-- room_sessions.room_sessions_teacher_select (definisi terakhir: 0098_pulihkan_policy_select_riwayat_room.sql)
drop policy if exists room_sessions_teacher_select on public.room_sessions;
create policy room_sessions_teacher_select on public.room_sessions
  for select
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = room_id and r.teacher_id = (select auth.uid()) ));

-- rooms.rooms_delete_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists rooms_delete_own on public.rooms;
create policy rooms_delete_own on public.rooms
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- rooms.rooms_insert_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists rooms_insert_own on public.rooms;
create policy rooms_insert_own on public.rooms
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

-- rooms.rooms_select_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists rooms_select_own on public.rooms;
create policy rooms_select_own on public.rooms
  for select
  to authenticated
  using (teacher_id = (select auth.uid()));

-- rooms.rooms_update_own (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists rooms_update_own on public.rooms;
create policy rooms_update_own on public.rooms
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- student_catchup_progress.student_catchup_progress_select_via_owned_class (definisi terakhir: 0115_tugas_susulan.sql)
drop policy if exists student_catchup_progress_select_via_owned_class on public.student_catchup_progress;
create policy student_catchup_progress_select_via_owned_class on public.student_catchup_progress
  for select
  to authenticated
  using (exists ( select 1 from public.students s join public.classes c on c.id = s.class_id where s.id = student_catchup_progress.student_id and c.teacher_id = (select auth.uid()) ));

-- student_game_results.student_game_results_select_via_owned_class (definisi terakhir: 0116_game_solo_siswa.sql)
drop policy if exists student_game_results_select_via_owned_class on public.student_game_results;
create policy student_game_results_select_via_owned_class on public.student_game_results
  for select
  to authenticated
  using (exists ( select 1 from public.students s join public.classes c on c.id = s.class_id where s.id = student_game_results.student_id and c.teacher_id = (select auth.uid()) ));

-- student_meeting_attendance.student_meeting_attendance_select_via_owned_class (definisi terakhir: 0115_tugas_susulan.sql)
drop policy if exists student_meeting_attendance_select_via_owned_class on public.student_meeting_attendance;
create policy student_meeting_attendance_select_via_owned_class on public.student_meeting_attendance
  for select
  to authenticated
  using (exists ( select 1 from public.students s join public.classes c on c.id = s.class_id where s.id = student_meeting_attendance.student_id and c.teacher_id = (select auth.uid()) ));

-- students.students_delete_via_owned_class (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists students_delete_via_owned_class on public.students;
create policy students_delete_via_owned_class on public.students
  for delete
  to authenticated
  using (exists ( select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid()) ));

-- students.students_insert_via_owned_class (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists students_insert_via_owned_class on public.students;
create policy students_insert_via_owned_class on public.students
  for insert
  to authenticated
  with check (exists ( select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid()) ));

-- students.students_select_via_owned_class (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists students_select_via_owned_class on public.students;
create policy students_select_via_owned_class on public.students
  for select
  to authenticated
  using (exists ( select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid()) ));

-- students.students_update_via_owned_class (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists students_update_via_owned_class on public.students;
create policy students_update_via_owned_class on public.students
  for update
  to authenticated
  using (exists ( select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid()) ))
  with check (exists ( select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid()) ));

-- submissions.submissions_delete_via_owned_room (definisi terakhir: 0112_grant_select_submissions_untuk_rantai_hapus.sql)
drop policy if exists submissions_delete_via_owned_room on public.submissions;
create policy submissions_delete_via_owned_room on public.submissions
  for delete
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = submissions.room_id and r.teacher_id = (select auth.uid()) ));

-- submissions.submissions_select_via_owned_room (definisi terakhir: 0002_rls_policies.sql)
drop policy if exists submissions_select_via_owned_room on public.submissions;
create policy submissions_select_via_owned_room on public.submissions
  for select
  to authenticated
  using (exists ( select 1 from public.rooms r where r.id = submissions.room_id and r.teacher_id = (select auth.uid()) ));

-- teacher_audio_tracks.teacher_audio_tracks_own (definisi terakhir: 0034_multiple_audio_tracks.sql)
drop policy if exists teacher_audio_tracks_own on public.teacher_audio_tracks;
create policy teacher_audio_tracks_own on public.teacher_audio_tracks
  for all
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- Kueri baca-saja untuk mengambil ekspresi 9 kebijakan asesmen yang
-- belum ditemukan definisinya di repo (jalankan terpisah, bukan bagian
-- perbaikan):
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies where policyname in ('teacher_own_assessments',
-- 'teacher_own_sections', 'teacher_own_questions', 'teacher_own_passages',
-- 'teacher_own_audio_groups', 'teacher_own_tokens',
-- 'teacher_read_attempts', 'teacher_read_attempt_sections',
-- 'teacher_read_answers');
