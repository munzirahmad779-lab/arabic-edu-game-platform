-- 0030_room_heartbeat_history.sql
-- 1. Tambah kolom last_seen_at di room_participants (untuk deteksi disconnect).
-- 2. Tabel room_sessions + room_session_participants (history).
-- 3. RPC heartbeat, archive, list, detail.

alter table public.room_participants
  add column if not exists last_seen_at timestamptz not null default now();

create table if not exists public.room_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  session_number int not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists room_sessions_room_id_idx
  on public.room_sessions (room_id, session_number desc);

create table if not exists public.room_session_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.room_sessions(id) on delete cascade,
  participant_name text not null,
  final_score int not null,
  rank int not null,
  correct_count int not null,
  total_questions int not null,
  avg_response_ms int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists room_session_participants_session_id_idx
  on public.room_session_participants (session_id, rank);

alter table public.room_sessions enable row level security;
alter table public.room_session_participants enable row level security;

-- ============ RPC HEARTBEAT ============
create or replace function public.heartbeat_room_participant(p_join_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.room_participants
  set last_seen_at = clock_timestamp()
  where join_token = p_join_token;
end;
$$;

revoke all on function public.heartbeat_room_participant(uuid) from public;
grant execute on function public.heartbeat_room_participant(uuid) to anon, authenticated;

-- ============ RPC ARCHIVE SESSION ============
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
    session_id, participant_name, final_score, rank,
    correct_count, total_questions, avg_response_ms
  )
  with stats as (
    select
      rp.id as p_id,
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
    v_session_id, r.p_name, r.fscore, r.rnk, r.correct_count,
    jsonb_array_length(v_questions), r.avg_resp
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

-- ============ RPC LIST SESSIONS (untuk guru) ============
create or replace function public.list_room_sessions(p_room_id uuid)
returns table (
  session_id uuid,
  session_number int,
  started_at timestamptz,
  ended_at timestamptz,
  participant_count int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    rs.id,
    rs.session_number,
    rs.started_at,
    rs.ended_at,
    (select count(*)::int from public.room_session_participants rsp where rsp.session_id = rs.id)
  from public.room_sessions rs
  where rs.room_id = p_room_id
  order by rs.session_number desc;
end;
$$;

revoke all on function public.list_room_sessions(uuid) from public;
grant execute on function public.list_room_sessions(uuid) to authenticated;

-- ============ RPC DETAIL SESSION ============
create or replace function public.get_room_session_detail(p_session_id uuid)
returns table (
  participant_name text,
  final_score int,
  rank int,
  correct_count int,
  total_questions int,
  avg_response_ms int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.room_sessions rs
    join public.rooms r on r.id = rs.room_id
    where rs.id = p_session_id and r.teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    rsp.participant_name,
    rsp.final_score,
    rsp.rank,
    rsp.correct_count,
    rsp.total_questions,
    rsp.avg_response_ms
  from public.room_session_participants rsp
  where rsp.session_id = p_session_id
  order by rsp.rank;
end;
$$;

revoke all on function public.get_room_session_detail(uuid) from public;
grant execute on function public.get_room_session_detail(uuid) to authenticated;