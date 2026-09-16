-- 0055_essay_theme.sql
-- Tambah field theme (tema/hint singkat) di essay_assignments.
-- Update RPC list & get untuk sertakan theme.

alter table public.essay_assignments
  add column if not exists theme text;

drop function if exists public.student_list_essays(text);

create or replace function public.student_list_essays(p_token text)
returns table (
  id uuid,
  title text,
  theme text,
  duration_minutes int,
  has_submission boolean,
  ai_score int,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
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
    (sub.id is not null) as has_submission,
    coalesce(sub.teacher_override_score, sub.ai_score)::int,
    sub.created_at
  from public.essay_assignments ea
  left join public.essay_submissions sub
    on sub.assignment_id = ea.id and sub.student_id = v_student_id
  where ea.class_id = v_class_id and ea.is_published = true
  order by ea.created_at desc;
end;
$$;

revoke all on function public.student_list_essays(text) from public;
grant execute on function public.student_list_essays(text) to anon, authenticated;

drop function if exists public.student_get_essay(text, uuid);

create or replace function public.student_get_essay(p_token text, p_essay_id uuid)
returns table (
  id uuid,
  title text,
  theme text,
  question_text text,
  duration_minutes int,
  my_answer text,
  my_score int,
  my_feedback text,
  my_scores_json jsonb,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

revoke all on function public.student_get_essay(text, uuid) from public;
grant execute on function public.student_get_essay(text, uuid) to anon, authenticated;