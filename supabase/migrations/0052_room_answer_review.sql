-- 0052_room_answer_review.sql
-- 1. Tabel stats soal per session.
-- 2. Update archive → isi stats.
-- 3. RPC guru: get_session_question_stats.
-- 4. RPC siswa: student_get_my_room_answers.

create table if not exists public.room_session_question_stats (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.room_sessions(id) on delete cascade,
  question_id uuid not null,
  question_text text,
  correct_option_key text,
  explanation text,
  options jsonb not null default '[]'::jsonb,
  total_answered int not null default 0,
  total_correct int not null default 0,
  selected_a_count int not null default 0,
  selected_b_count int not null default 0,
  selected_c_count int not null default 0,
  selected_d_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rsqs_session_id_idx
  on public.room_session_question_stats (session_id);

alter table public.room_session_question_stats enable row level security;
grant select on public.room_session_question_stats to authenticated;

drop policy if exists rsqs_teacher_select on public.room_session_question_stats;
create policy rsqs_teacher_select on public.room_session_question_stats
  for select to authenticated
  using (
    exists (
      select 1
      from public.room_sessions rs
      join public.rooms r on r.id = rs.room_id
      where rs.id = session_id and r.teacher_id = auth.uid()
    )
  );

-- ============ Update archive RPC ============
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
  v_q jsonb;
  v_q_id uuid;
  v_correct_key text;
  v_q_text text;
  v_q_expl text;
  v_q_options jsonb;
  v_total int;
  v_correct int;
  v_a int;
  v_b int;
  v_c int;
  v_d int;
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

  -- Stats per soal
  for v_q in select * from jsonb_array_elements(v_questions) loop
    v_q_id := (v_q->'question'->>'id')::uuid;
    v_correct_key := v_q->'question'->>'correct_option_key';
    v_q_text := v_q->'question'->>'question_text';
    v_q_expl := v_q->'question'->>'explanation';
    v_q_options := coalesce(v_q->'question'->'options', '[]'::jsonb);

    select
      count(*)::int,
      coalesce(sum(case when is_correct then 1 else 0 end), 0)::int
    into v_total, v_correct
    from public.submissions s
    where s.room_id = p_room_id and s.question_id = v_q_id;

    select
      coalesce(sum(case when o->>'option_key' = 'A' then 1 else 0 end), 0)::int,
      coalesce(sum(case when o->>'option_key' = 'B' then 1 else 0 end), 0)::int,
      coalesce(sum(case when o->>'option_key' = 'C' then 1 else 0 end), 0)::int,
      coalesce(sum(case when o->>'option_key' = 'D' then 1 else 0 end), 0)::int
    into v_a, v_b, v_c, v_d
    from public.submissions s
    join jsonb_array_elements(v_q_options) o
      on o->>'id' = s.selected_option_id
    where s.room_id = p_room_id and s.question_id = v_q_id;

    insert into public.room_session_question_stats (
      session_id, question_id, question_text, correct_option_key, explanation,
      options, total_answered, total_correct,
      selected_a_count, selected_b_count, selected_c_count, selected_d_count
    ) values (
      v_session_id, v_q_id, v_q_text, v_correct_key, v_q_expl,
      v_q_options, coalesce(v_total, 0), coalesce(v_correct, 0),
      coalesce(v_a, 0), coalesce(v_b, 0), coalesce(v_c, 0), coalesce(v_d, 0)
    );
  end loop;

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

-- ============ RPC guru: stats soal ============
create or replace function public.get_session_question_stats(p_session_id uuid)
returns table (
  question_id uuid,
  question_text text,
  correct_option_key text,
  explanation text,
  options jsonb,
  total_answered int,
  total_correct int,
  selected_a_count int,
  selected_b_count int,
  selected_c_count int,
  selected_d_count int
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
    qs.question_id,
    qs.question_text,
    qs.correct_option_key,
    qs.explanation,
    qs.options,
    qs.total_answered,
    qs.total_correct,
    qs.selected_a_count,
    qs.selected_b_count,
    qs.selected_c_count,
    qs.selected_d_count
  from public.room_session_question_stats qs
  where qs.session_id = p_session_id
  order by qs.created_at;
end;
$$;

revoke all on function public.get_session_question_stats(uuid) from public;
grant execute on function public.get_session_question_stats(uuid) to authenticated;

-- ============ RPC siswa: review jawaban sendiri ============
create or replace function public.student_get_my_room_answers(p_join_token uuid)
returns table (
  question_position int,
  question_text text,
  correct_option_key text,
  explanation text,
  options jsonb,
  selected_option_key text,
  is_correct boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
begin
  select r.* into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token;

  if not found then raise exception 'INVALID_JOIN_TOKEN'; end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  if v_room.state <> 'ended' then
    raise exception 'GAME_NOT_ENDED';
  end if;

  return query
  with qs as (
    select
      coalesce((entry->>'position')::int, 0) as q_pos,
      (entry->'question'->>'id')::uuid as q_id,
      entry->'question'->>'question_text' as q_text,
      entry->'question'->>'correct_option_key' as q_correct,
      entry->'question'->>'explanation' as q_expl,
      coalesce(entry->'question'->'options', '[]'::jsonb) as q_opts
    from jsonb_array_elements(v_room.snapshot->'questions') as entry
  )
  select
    qs.q_pos,
    qs.q_text,
    qs.q_correct,
    qs.q_expl,
    qs.q_opts,
    selected_opt.option_key,
    coalesce(s.is_correct, false)
  from qs
  left join public.submissions s
    on s.question_id = qs.q_id
    and s.room_participant_id = v_participant.id
    and s.room_id = v_room.id
  left join lateral (
    select o->>'option_key' as option_key
    from jsonb_array_elements(qs.q_opts) o
    where o->>'id' = s.selected_option_id
    limit 1
  ) selected_opt on true
  order by qs.q_pos;
end;
$$;

revoke all on function public.student_get_my_room_answers(uuid) from public;
grant execute on function public.student_get_my_room_answers(uuid) to anon, authenticated;