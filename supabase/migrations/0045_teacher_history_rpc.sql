-- 0045_teacher_history_rpc.sql
-- RPC untuk history guru — join di SQL, bypass RLS.

drop function if exists public.teacher_list_room_history();
drop function if exists public.teacher_list_practice_history();

create or replace function public.teacher_list_room_history()
returns table (
  session_id uuid,
  session_number int,
  started_at timestamptz,
  ended_at timestamptz,
  room_id uuid,
  room_code text,
  game_id uuid,
  game_name text,
  game_mode text,
  participant_count int
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return query
  select
    rs.id,
    rs.session_number,
    rs.started_at,
    rs.ended_at,
    r.id,
    r.code,
    g.id,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'competitive'),
    (select count(*)::int
       from public.room_session_participants rsp
      where rsp.session_id = rs.id)
  from public.room_sessions rs
  join public.rooms r on r.id = rs.room_id
  left join public.games g on g.id = r.game_id
  where r.teacher_id = auth.uid()
  order by rs.created_at desc
  limit 100;
end;
$$;

create or replace function public.teacher_list_practice_history()
returns table (
  game_id uuid,
  game_name text,
  mode text,
  student_id uuid,
  student_name text,
  answered int,
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

  return query
  with aggregated as (
    select
      spa.game_id,
      spa.student_id,
      count(*)::int as answered,
      sum(case when spa.is_correct then 1 else 0 end)::int as correct_count,
      max(spa.answered_at) as last_activity
    from public.student_practice_answers spa
    join public.students s on s.id = spa.student_id
    join public.classes c on c.id = s.class_id
    where c.teacher_id = auth.uid()
    group by spa.game_id, spa.student_id
  )
  select
    a.game_id,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'endless'),
    a.student_id,
    coalesce(s.name, '—'),
    a.answered,
    a.correct_count,
    (select count(*)::int from public.game_questions gq where gq.game_id = a.game_id),
    a.last_activity
  from aggregated a
  left join public.games g on g.id = a.game_id
  left join public.students s on s.id = a.student_id
  order by a.last_activity desc
  limit 200;
end;
$$;

revoke all on function public.teacher_list_room_history() from public;
grant execute on function public.teacher_list_room_history() to authenticated;

revoke all on function public.teacher_list_practice_history() from public;
grant execute on function public.teacher_list_practice_history() to authenticated;