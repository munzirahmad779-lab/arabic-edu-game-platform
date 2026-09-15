-- 0048_history_consolidation.sql
-- 1. Tambah student_id di room_session_participants + backfill.
-- 2. Update RPC archive_room_session → simpan student_id.
-- 3. Update RPC teacher_class_history → pakai student_id (bukan nama).
-- 4. RPC baru: delete_student_history.
-- 5. Update RPC teacher_daily_report → range TZ lokal.

-- ============ 1. Tambah kolom ============
alter table public.room_session_participants
  add column if not exists student_id uuid
  references public.students(id) on delete set null;

create index if not exists rsp_student_id_idx
  on public.room_session_participants (student_id);

-- ============ 2. Update archive RPC ============
drop function if exists public.archive_room_session(uuid);

create or replace function public.archive_room_session(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_session_id uuid;
  v_session_number int;
  v_total_weight int;
  v_avg_limit_ms int;
  v_questions jsonb;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.teacher_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_total_weight := public.game_total_weight(v_questions);
  v_avg_limit_ms := public.game_avg_limit_ms(v_questions);

  select coalesce(max(session_number), 0) + 1
    into v_session_number
  from public.room_sessions where room_id = p_room_id;

  v_session_id := extensions.gen_random_uuid();

  insert into public.room_sessions (id, room_id, session_number, started_at, ended_at)
  values (v_session_id, p_room_id, v_session_number, v_room.started_at, v_room.ended_at);

  insert into public.room_session_participants (
    session_id, participant_name, student_id, final_score, rank,
    correct_count, total_questions, avg_response_ms
  )
  with stats as (
    select
      rp.id as p_id,
      rp.student_id as p_student_id,
      coalesce(
        (select s.name from public.students s where s.id = rp.student_id),
        rp.guest_name,
        'طالب'
      ) as p_name,
      count(sub.id)::int as answered_count,
      sum(case when sub.is_correct then 1 else 0 end)::int as correct_count,
      coalesce(sum(sub.score_awarded), 0)::int as weighted_correct,
      coalesce(avg(sub.response_time_ms), v_avg_limit_ms)::int as avg_resp
    from public.room_participants rp
    left join public.submissions sub
      on sub.room_participant_id = rp.id and sub.room_id = p_room_id
    where rp.room_id = p_room_id
    group by rp.id, rp.student_id, rp.guest_name
  ),
  scored as (
    select st.*,
      case
        when v_total_weight = 0 then 0
        else round(
          (st.weighted_correct::numeric / v_total_weight) * 80
          + case
            when v_avg_limit_ms = 0 then 0
            else greatest(0, least(20,
              ((v_avg_limit_ms - st.avg_resp)::numeric / v_avg_limit_ms) * 20
            ))
          end
        )::int
      end as fscore
    from stats st
  ),
  ranked as (
    select s.*,
      row_number() over (order by s.fscore desc, s.avg_resp asc)::int as rnk
    from scored s
  )
  select
    v_session_id,
    r.p_name,
    r.p_student_id,
    r.fscore,
    r.rnk,
    r.correct_count,
    jsonb_array_length(v_questions),
    r.avg_resp
  from ranked r;

  delete from public.submissions where room_id = p_room_id;
  delete from public.room_participants where room_id = p_room_id;

  update public.rooms
  set state = 'waiting',
      started_at = null,
      ended_at = null,
      current_question_index = 0,
      question_started_at = null
  where id = p_room_id;

  return v_session_id;
end;
$$;

revoke all on function public.archive_room_session(uuid) from public;
grant execute on function public.archive_room_session(uuid) to authenticated;

-- ============ 3. Update class history RPC ============
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
  -- Room-based by student_id
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
      on rsp.student_id = s.id
    join public.room_sessions rs on rs.id = rsp.session_id
    join public.rooms r on r.id = rs.room_id
    join public.games g on g.id = r.game_id
    where r.class_id = p_class_id
      and g.mode in ('competitive', 'cooperative', 'learning')
    group by s.id, s.name, g.mode
  ),
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
    c.s_id,
    c.s_name,
    c.g_mode,
    c.sessions_count,
    c.best_score,
    c.avg_score,
    c.correct_count,
    c.total_questions,
    c.last_act
  from combined c
  order by c.s_name, c.g_mode;
end;
$$;

revoke all on function public.teacher_class_history(uuid) from public;
grant execute on function public.teacher_class_history(uuid) to authenticated;

-- ============ 4. Delete student history ============
drop function if exists public.teacher_delete_student_history(uuid);

create or replace function public.teacher_delete_student_history(p_student_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_total int := 0;
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.class_id, c.teacher_id
    into v_class_id, v_teacher_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student_id;

  if v_teacher_id is null then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if v_teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  -- Hapus practice answers
  delete from public.student_practice_answers
  where student_id = p_student_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  -- Hapus room participant history (bukan submissions, sudah selesai)
  delete from public.room_session_participants
  where student_id = p_student_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;

revoke all on function public.teacher_delete_student_history(uuid) from public;
grant execute on function public.teacher_delete_student_history(uuid) to authenticated;

-- ============ 5. Update daily report RPC ============
drop function if exists public.teacher_daily_report(date);

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

  -- Range pukul 00:00 sampai 23:59:59 WIB (Asia/Jakarta) untuk hari itu
  v_start := (p_date::text || ' 00:00:00+07')::timestamptz;
  v_end := (p_date::text || ' 23:59:59+07')::timestamptz;

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
    and rs.created_at <= v_end;

  -- Practice
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
    and spa.answered_at <= v_end
  group by s.id, s.name, g.name, g.mode, spa.game_id;
end;
$$;

revoke all on function public.teacher_daily_report(date) from public;
grant execute on function public.teacher_daily_report(date) to authenticated;