-- 0047_history_cleanup_and_reports.sql
-- 1. Cleanup function: hapus history > 7 hari.
-- 2. RPC laporan harian guru (room + practice).

create or replace function public.cleanup_old_history()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_total int := 0;
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from public.room_session_participants
  where session_id in (
    select id from public.room_sessions
    where created_at < now() - interval '7 days'
  );
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.room_sessions
  where created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.student_practice_answers
  where answered_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;

create or replace function public.teacher_daily_report(p_date date)
returns table (
  source text,
  game_name text,
  game_mode text,
  student_name text,
  final_score int,
  rank_position int,
  correct_count int,
  total_questions int,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_start := p_date::timestamptz;
  v_end := (p_date + interval '1 day')::timestamptz;

  -- Room sessions
  return query
  select
    'room'::text,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'competitive'),
    rsp.participant_name,
    rsp.final_score,
    rsp.rank,
    rsp.correct_count,
    rsp.total_questions,
    rs.created_at
  from public.room_session_participants rsp
  join public.room_sessions rs on rs.id = rsp.session_id
  join public.rooms r on r.id = rs.room_id
  left join public.games g on g.id = r.game_id
  where r.teacher_id = auth.uid()
    and rs.created_at >= v_start
    and rs.created_at < v_end;

  -- Practice (aggregate per student+game per day)
  return query
  select
    'practice'::text,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'endless'),
    s.name,
    null::int,
    null::int,
    sum(case when spa.is_correct then 1 else 0 end)::int,
    (select count(*)::int from public.game_questions gq where gq.game_id = spa.game_id),
    max(spa.answered_at)
  from public.student_practice_answers spa
  join public.students s on s.id = spa.student_id
  join public.classes c on c.id = s.class_id
  left join public.games g on g.id = spa.game_id
  where c.teacher_id = auth.uid()
    and spa.answered_at >= v_start
    and spa.answered_at < v_end
  group by s.id, s.name, g.name, g.mode, spa.game_id;
end;
$$;

revoke all on function public.cleanup_old_history() from public;
grant execute on function public.cleanup_old_history() to authenticated;

revoke all on function public.teacher_daily_report(date) from public;
grant execute on function public.teacher_daily_report(date) to authenticated;