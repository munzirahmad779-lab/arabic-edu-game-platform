-- 0051_fix_reports_and_progress.sql
-- 1. Update RPC progress practice: return explanation + correct key.
-- 2. Update RPC daily report: default WIB (dari client), filter tetap WIB.

drop function if exists public.student_get_practice_progress(text, uuid);

create or replace function public.student_get_practice_progress(
  p_token text,
  p_game_id uuid
)
returns table (
  question_id uuid,
  selected_option_key text,
  is_correct boolean,
  answered_at timestamptz,
  correct_option_key text,
  explanation text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
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
  where spa.student_id = v_student_id and spa.game_id = p_game_id;
end;
$$;

revoke all on function public.student_get_practice_progress(text, uuid) from public;
grant execute on function public.student_get_practice_progress(text, uuid) to anon, authenticated;