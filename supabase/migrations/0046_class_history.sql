-- 0046_class_history.sql
-- RPC: history per siswa per mode dalam satu kelas.

drop function if exists public.teacher_class_history(uuid);

create or replace function public.teacher_class_history(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  mode text,
  sessions_count int,
  best_score int,
  avg_score numeric,
  correct_count int,
  total_questions int,
  last_activity timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  with students_in_class as (
    select s.id, s.name
    from public.students s
    where s.class_id = p_class_id
  ),
  -- Room-based: competitive, cooperative, learning
  room_stats as (
    select
      s.id as s_id,
      s.name as s_name,
      g.mode as g_mode,
      count(distinct rs.id)::int as sessions_count,
      max(rsp.final_score)::int as best_score,
      round(avg(rsp.final_score), 1) as avg_score,
      sum(rsp.correct_count)::int as correct_count,
      sum(rsp.total_questions)::int as total_questions,
      max(rs.created_at) as last_act
    from students_in_class s
    join public.room_session_participants rsp
      on rsp.participant_name = s.name
    join public.room_sessions rs on rs.id = rsp.session_id
    join public.rooms r on r.id = rs.room_id
    join public.games g on g.id = r.game_id
    where r.class_id = p_class_id
      and g.mode in ('competitive', 'cooperative', 'learning')
    group by s.id, s.name, g.mode
  ),
  -- Practice: endless, practice (aggregate per game per student)
  practice_stats as (
    select
      s.id as s_id,
      s.name as s_name,
      g.mode as g_mode,
      count(distinct spa.game_id)::int as sessions_count,
      null::int as best_score,
      null::numeric as avg_score,
      sum(case when spa.is_correct then 1 else 0 end)::int as correct_count,
      sum(sub.total_q)::int as total_questions,
      max(spa.answered_at) as last_act
    from students_in_class s
    join public.student_practice_answers spa on spa.student_id = s.id
    join public.games g on g.id = spa.game_id
    join lateral (
      select count(*)::int as total_q
      from public.game_questions gq
      where gq.game_id = spa.game_id
    ) sub on true
    group by s.id, s.name, g.mode
  ),
  combined as (
    select * from room_stats
    union all
    select * from practice_stats
  )
  select
    c.s_id as student_id,
    c.s_name as student_name,
    c.g_mode as mode,
    c.sessions_count,
    c.best_score,
    c.avg_score,
    c.correct_count,
    c.total_questions,
    c.last_act as last_activity
  from combined c
  order by c.s_name, c.g_mode;
end;
$$;

revoke all on function public.teacher_class_history(uuid) from public;
grant execute on function public.teacher_class_history(uuid) to authenticated;