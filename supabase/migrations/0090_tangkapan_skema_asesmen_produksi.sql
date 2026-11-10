-- ============================================================================
-- 0090_tangkapan_skema_asesmen_produksi.sql
-- Status: BERKAS TANGKAPAN (capture) — BUKAN untuk diterapkan ke produksi.
-- Memuat skema wilayah asesmen/latihan/esai persis seperti keadaan
-- produksi proyek zwenvfoolgwlcjprnxlk pada 10 Nov 2026 (ekspor katalog
-- baca-saja: information_schema, pg_class, pg_policies, pg_get_functiondef).
-- Pasangan berkas 0088 (wilayah sesi siswa).
--
-- GAMBARAN KEAMANAN WILAYAH INI (dasar temuan W3-K3 mega-audit):
-- - Latihan dan esai berjalan di pola yang BENAR: fungsi student_*
--   SECURITY DEFINER, gerbang verify_student_session, penilaian di
--   server (student_submit_practice_answer), kunci tidak keluar sebelum
--   menjawab. Kedelapan definisinya tertangkap utuh di Bagian 3.
-- - Asesmen (ujian ber-attempt_token) berjalan di pola yang JEBOL:
--   policy anon memberi akses langsung ke tabel. Nama policy + role
--   terverifikasi dari pg_policies; teks qual/with_check policy anon
--   BELUM tertangkap (verifikasi lanjutan diperlukan sebelum vonis
--   per policy), tetapi kode aplikasi membuktikan perilakunya:
--   player asesmen membaca correct_answer dari assessment_questions
--   sebagai anon dan menulis is_correct serta skor ke
--   assessment_answers/assessment_attempts dari browser
--   (src/app/assessment/[attemptToken]/player.tsx).
--   Policy yang tercatat: assessment_answers anon_all (ALL),
--   assessment_attempt_sections anon_all (ALL), assessment_attempts
--   anon INSERT+SELECT+UPDATE, assessment_questions anon SELECT,
--   assessment_tokens anon SELECT, assessments/sections/passages/
--   audio_groups anon SELECT.
-- - Perbaikan W3-K3 yang dirancang dari tangkapan ini: tiru pola
--   student_* — RPC bergerbang attempt_token untuk mengambil soal
--   TANPA correct_answer, menilai jawaban di server, menghitung skor
--   akhir di server; sesudah player aplikasi memakai RPC itu, policy
--   anon langsung ke tabel ditutup. Urutan wajib: RPC + player dulu,
--   pengetatan policy terakhir, supaya ujian live tidak putus.
--
-- KETERBATASAN TANGKAPAN: daftar kolom G2 terpotong pada batas 100
-- baris editor. Kolom essay_submissions dan student_practice_answers
-- serta sisa kolom essay_assignments dilengkapi dari badan fungsi
-- Bagian 3 yang membacanya (ditandai *). Constraint dan indeks wilayah
-- ini belum diekspor; RLS semua tabel di bawah: AKTIF.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bagian 1: Tabel asesmen (kolom terverifikasi katalog)
-- ----------------------------------------------------------------------------
-- assessments: id uuid pk default gen_random_uuid(); teacher_id uuid not null;
--   title text not null; description text; assessment_type text not null
--   default 'toefl_itp'; level text; is_published boolean not null default
--   false; total_duration_minutes int not null default 0; total_questions
--   int not null default 0; scoring_config jsonb not null default '{}';
--   created_at/updated_at timestamptz not null default now().
-- assessment_sections: id; assessment_id uuid not null; section_order int
--   not null; section_type text not null; title text not null; instructions
--   text; duration_minutes int not null; audio_play_once boolean not null
--   default false; allow_review boolean not null default true;
--   question_count int not null default 0; created_at.
-- assessment_questions: id; assessment_id uuid not null; section_id uuid
--   not null; question_number int not null; question_text text not null;
--   option_a..option_d text not null; correct_answer text not null;
--   passage_id uuid; audio_group_id uuid; difficulty text; created_at.
-- assessment_passages: id; assessment_id; section_id; passage_order int
--   not null; title text; content text not null; created_at.
-- assessment_audio_groups: id; assessment_id; section_id; group_order int
--   not null; title text; audio_url text; storage_path text;
--   duration_seconds int; created_at.
-- assessment_tokens: id; token text not null; assessment_id uuid not null;
--   student_id uuid; student_name text; is_used boolean not null default
--   false; used_at timestamptz; created_at; expires_at timestamptz.
-- assessment_attempts: id; attempt_token text not null; assessment_id uuid
--   not null; token_id uuid; student_name text not null; student_id uuid;
--   started_at timestamptz not null default now(); finished_at timestamptz;
--   current_section_order int not null default 1; current_question_number
--   int not null default 1; raw_listening/raw_structure/raw_reading int;
--   score_listening/score_structure/score_reading/score_total int;
--   status text not null default 'in_progress'; created_at.
-- assessment_attempt_sections: id; attempt_id uuid not null; section_id
--   uuid not null; started_at/finished_at timestamptz; time_spent_seconds
--   int; status text not null default 'pending'.
-- assessment_answers: id; attempt_id uuid not null; question_id uuid not
--   null; selected_answer text; is_correct boolean; answered_at
--   timestamptz not null default now().

-- ----------------------------------------------------------------------------
-- Bagian 2: Policy tercatat (nama | cmd | roles), RLS aktif di semua tabel
-- ----------------------------------------------------------------------------
-- assessments: anon_read_assessment SELECT {anon}; teacher_own_assessments ALL {public}
-- assessment_sections: anon_read_sections SELECT {anon}; teacher_own_sections ALL {public}
-- assessment_questions: anon_read_questions SELECT {anon}; teacher_own_questions ALL {public}
-- assessment_passages: anon_read_passages SELECT {anon}; teacher_own_passages ALL {public}
-- assessment_audio_groups: anon_read_audio_groups SELECT {anon}; teacher_own_audio_groups ALL {public}
-- assessment_tokens: anon_read_tokens SELECT {anon}; teacher_own_tokens ALL {public}
-- assessment_attempts: anon_insert_attempts INSERT {anon}; anon_read_attempts SELECT {anon};
--   anon_update_attempts UPDATE {anon}; teacher_read_attempts SELECT {public}
-- assessment_attempt_sections: anon_all_attempt_sections ALL {anon}; teacher_read_attempt_sections SELECT {public}
-- assessment_answers: anon_all_answers ALL {anon}; teacher_read_answers SELECT {public}
-- essay_assignments: essay_assignments_teacher_all ALL {authenticated}
-- essay_submissions: essay_submissions_teacher_all ALL {authenticated}
-- student_practice_answers: (RLS aktif, TANPA policy — hanya fungsi definer)
-- Kolom essay_assignments tambahan dari fungsi*: theme, duration_minutes,
-- is_published (di samping id, teacher_id, class_id, title, question_text,
-- ideal_answer yang tertangkap katalog).
-- Kolom essay_submissions dari fungsi*: assignment_id, student_id,
-- answer_text, duration_seconds, ai_score, ai_feedback, ai_scores_json,
-- teacher_override_score, teacher_override_feedback, created_at.
-- Kolom student_practice_answers dari fungsi*: student_id, game_id,
-- question_id, selected_option_key, is_correct, answered_at
-- (unik student_id+game_id+question_id, dari klausa on conflict fungsi).

-- ----------------------------------------------------------------------------
-- Bagian 3: Fungsi student_* wilayah latihan/esai (persis produksi)
-- Seluruhnya SECURITY DEFINER, search_path 'public','extensions',
-- bergerbang public.verify_student_session(p_token).
-- Teks lengkap kedelapan fungsi (student_list_practice_games,
-- student_get_practice_game, student_submit_practice_answer,
-- student_get_practice_progress, student_reset_practice,
-- student_list_essays, student_get_essay, student_submit_essay)
-- tersimpan pada keluaran ekspor katalog 10 Nov 2026 tahap 8 dan
-- diringkas di sini sebagai penunjuk; definisi yang mengikat untuk
-- pembangunan ulang adalah pg_get_functiondef produksi. Fungsi yang
-- paling menentukan pola (penilaian server) diabadikan utuh di bawah.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_submit_practice_answer(p_token text, p_game_id uuid, p_question_id uuid, p_selected_option_key text)
 RETURNS TABLE(accepted boolean, is_correct boolean, correct_option_key text, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
v_correct_key text;
v_explanation text;
v_is_correct boolean;
begin
select s.student_id, s.class_id
into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

if not exists (
 select 1 from public.game_questions gq
 join public.games g on g.id = gq.game_id
 where gq.game_id = p_game_id
 and gq.question_id = p_question_id
 and g.class_id = v_class_id
) then
 raise exception 'question_not_in_game';
end if;

select q.correct_option_key, q.explanation
into v_correct_key, v_explanation
from public.questions q
where q.id = p_question_id;

if not found then
 raise exception 'question_not_found';
end if;

if p_selected_option_key is null or btrim(p_selected_option_key) = '' then
 raise exception 'option_missing';
end if;

if v_correct_key is null then
 raise exception 'question_missing_key';
end if;

v_is_correct := (p_selected_option_key = v_correct_key);

insert into public.student_practice_answers (
 student_id, game_id, question_id, selected_option_key, is_correct, answered_at
) values (
 v_student_id, p_game_id, p_question_id, p_selected_option_key, v_is_correct, now()
) on conflict (student_id, game_id, question_id) do update set
 selected_option_key = excluded.selected_option_key,
 is_correct = excluded.is_correct,
 answered_at = excluded.answered_at;

return query
select true, v_is_correct, v_correct_key, v_explanation;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Bagian 3 lanjutan: tujuh fungsi student_* lainnya, persis produksi
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_list_practice_games(p_token text)
 RETURNS TABLE(id uuid, name text, mode text, question_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
begin
select s.student_id, s.class_id
into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

return query
select
 g.id,
 g.name,
 g.mode,
 (
  select count(*)::int
  from public.game_questions gq
  where gq.game_id = g.id
 ) as question_count
from public.games g
where g.class_id = v_class_id
and g.mode in ('endless', 'practice')
order by g.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_get_practice_game(p_token text, p_game_id uuid)
 RETURNS TABLE(game_id uuid, game_name text, game_mode text, questions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
v_game record;
v_questions jsonb;
begin
select s.student_id, s.class_id
into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

select g.id, g.name, g.mode
into v_game
from public.games g
where g.id = p_game_id
and g.class_id = v_class_id
and g.mode in ('endless', 'practice');

if not found then
 raise exception 'game_not_found';
end if;

select coalesce(jsonb_agg(
 jsonb_build_object(
 'id', q.id,
 'question_text', q.question_text,
 'difficulty', q.difficulty,
 'options', coalesce((
  select jsonb_agg(jsonb_build_object(
  'id', qo.id,
  'option_key', qo.option_key,
  'option_text', qo.option_text
  ) order by qo.option_key)
  from public.question_options qo
  where qo.question_id = q.id
 ), '[]'::jsonb),
 'media', coalesce((
  select jsonb_agg(jsonb_build_object(
  'id', qm.id,
  'media_type', qm.media_type,
  'storage_path', qm.storage_path,
  'mime_type', qm.mime_type,
  'max_play_count', qm.max_play_count
  ) order by qm.id)
  from public.question_media qm
  where qm.question_id = q.id
 ), '[]'::jsonb)
 ) order by gq."position"
) , '[]'::jsonb)
into v_questions
from public.game_questions gq
join public.questions q on q.id = gq.question_id
where gq.game_id = p_game_id;

return query
select v_game.id, v_game.name, v_game.mode, v_questions;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_get_practice_progress(p_token text, p_game_id uuid)
 RETURNS TABLE(question_id uuid, selected_option_key text, is_correct boolean, answered_at timestamp with time zone, correct_option_key text, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
begin
select s.student_id, s.class_id
into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

if not exists (
 select 1 from public.games g
 where g.id = p_game_id and g.class_id = v_class_id
) then
 raise exception 'game_not_found';
end if;

return query
select
 spa.question_id,
 spa.selected_option_key,
 spa.is_correct,
 spa.answered_at,
 q.correct_option_key,
 q.explanation
from public.student_practice_answers spa
join public.questions q on q.id = spa.question_id
where spa.student_id = v_student_id
and spa.game_id = p_game_id
order by spa.answered_at asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_reset_practice(p_token text, p_game_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
begin
select s.student_id, s.class_id
into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

if not exists (
 select 1 from public.games g
 where g.id = p_game_id and g.class_id = v_class_id
) then
 raise exception 'game_not_found';
end if;

delete from public.student_practice_answers
where student_id = v_student_id and game_id = p_game_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_list_essays(p_token text)
 RETURNS TABLE(id uuid, title text, theme text, duration_minutes integer, has_submission boolean, ai_score integer, submitted_at timestamp with time zone, question_text text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
begin
select s.student_id, s.class_id into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

return query
select
 ea.id,
 ea.title,
 ea.theme,
 ea.duration_minutes,
 (sub is not null) as has_submission,
 coalesce(sub.teacher_override_score, sub.ai_score)::int,
 sub.created_at,
 ea.question_text
from public.essay_assignments ea
left join public.essay_submissions sub
 on sub.assignment_id = ea.id and sub.student_id = v_student_id
where ea.class_id = v_class_id
and ea.is_published = true
order by ea.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_get_essay(p_token text, p_essay_id uuid)
 RETURNS TABLE(id uuid, title text, theme text, question_text text, duration_minutes integer, my_answer text, my_score integer, my_feedback text, ai_scores_json jsonb, submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
begin
select s.student_id, s.class_id into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

return query
select
 ea.id,
 ea.title,
 ea.theme,
 ea.question_text,
 ea.duration_minutes,
 sub.answer_text,
 coalesce(sub.teacher_override_score, sub.ai_score)::int,
 coalesce(sub.teacher_override_feedback, sub.ai_feedback),
 sub.ai_scores_json,
 sub.created_at
from public.essay_assignments ea
left join public.essay_submissions sub
 on sub.assignment_id = ea.id and sub.student_id = v_student_id
where ea.id = p_essay_id
and ea.class_id = v_class_id
and ea.is_published = true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.student_submit_essay(p_token text, p_essay_id uuid, p_answer_text text, p_duration_seconds integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
v_student_id uuid;
v_class_id uuid;
v_sub_id uuid;
begin
select s.student_id, s.class_id into v_student_id, v_class_id
from public.verify_student_session(p_token) s
limit 1;

if v_student_id is null then
 raise exception 'invalid_session';
end if;

if p_answer_text is null or length(btrim(p_answer_text)) < 10 then
 raise exception 'answer_too_short';
end if;

if length(p_answer_text) > 20000 then
 raise exception 'answer_too_long';
end if;

if not exists (
 select 1 from public.essay_assignments ea
 where ea.id = p_essay_id
 and ea.class_id = v_class_id
 and ea.is_published = true
) then
 raise exception 'essay_not_found';
end if;

if exists (
 select 1 from public.essay_submissions
 where assignment_id = p_essay_id and student_id = v_student_id
) then
 raise exception 'already_submitted';
end if;

insert into public.essay_submissions (
 assignment_id, student_id, answer_text, duration_seconds
) values (
 p_essay_id, v_student_id, btrim(p_answer_text), p_duration_seconds
)
returning id into v_sub_id;

return v_sub_id;
end;
$function$;
