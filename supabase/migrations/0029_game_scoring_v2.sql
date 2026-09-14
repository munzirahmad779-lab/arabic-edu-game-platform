-- 0029_game_scoring_v2.sql
-- Sistem skor baru: akurasi berbobot (max 80) + bonus kecepatan (max 20) = 100
-- Time limit per difficulty: easy=20s, medium=30s, hard=45s

create or replace function public.game_time_limit_for_difficulty(p_difficulty text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_difficulty, 'easy')
    when 'easy' then 20
    when 'medium' then 30
    when 'hard' then 45
    else 20
  end;
$$;

create or replace function public.game_weight_for_difficulty(p_difficulty text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_difficulty, 'easy')
    when 'easy' then 1
    when 'medium' then 2
    when 'hard' then 3
    else 1
  end;
$$;

create or replace function public.game_total_weight(p_questions jsonb)
returns integer
language sql
immutable
as $$
  select coalesce(sum(
    public.game_weight_for_difficulty(coalesce(entry->'question'->>'difficulty', 'easy'))
  ), 0)::int
  from jsonb_array_elements(p_questions) as entry;
$$;

create or replace function public.game_avg_limit_ms(p_questions jsonb)
returns integer
language sql
immutable
as $$
  select case
    when jsonb_array_length(p_questions) = 0 then 20000
    else (
      select (sum(public.game_time_limit_for_difficulty(
        coalesce(entry->'question'->>'difficulty', 'easy')
      )) * 1000 / jsonb_array_length(p_questions))::int
      from jsonb_array_elements(p_questions) as entry
    )
  end;
$$;

drop function if exists public.get_game_session(uuid);
drop function if exists public.submit_game_answer(uuid, uuid, text);
drop function if exists public.get_room_leaderboard_student(uuid);
drop function if exists public.get_room_leaderboard_teacher(uuid);

create function public.get_game_session(p_join_token uuid)
returns table (
  room_id uuid,
  room_code text,
  game_name text,
  room_state text,
  participant_id uuid,
  participant_name text,
  participant_count integer,
  capacity integer,
  duration_seconds integer,
  question_index integer,
  question_count integer,
  question_started_at timestamptz,
  question jsonb,
  answer_submitted boolean,
  server_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
  v_game jsonb;
  v_questions jsonb;
  v_entry jsonb;
  v_question jsonb;
  v_question_count integer;
  v_answer_submitted boolean := false;
  v_now timestamptz := clock_timestamp();
  v_current_diff text;
  v_current_limit_s int;
begin
  select r.*
    into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token
  for update of r;

  if not found then
    raise exception 'INVALID_JOIN_TOKEN';
  end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  v_game := coalesce(v_room.snapshot->'game', '{}'::jsonb);
  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_question_count := jsonb_array_length(v_questions);

  if v_question_count < 1 then
    raise exception 'ROOM_HAS_NO_QUESTIONS';
  end if;

  if v_room.state = 'running'
     and v_room.question_started_at is not null
     and v_room.current_question_index >= 0
     and v_room.current_question_index < v_question_count then
    v_entry := v_questions -> v_room.current_question_index;
    v_question := coalesce(v_entry->'question', '{}'::jsonb);
    v_current_diff := coalesce(v_question->>'difficulty', 'easy');
    v_current_limit_s := public.game_time_limit_for_difficulty(v_current_diff);

    if v_now >= v_room.question_started_at + (v_current_limit_s || ' seconds')::interval then
      if v_room.current_question_index + 1 < v_question_count then
        update public.rooms
        set current_question_index = v_room.current_question_index + 1,
            question_started_at = v_now + interval '3 seconds'
        where id = v_room.id and state = 'running';
      else
        update public.rooms
        set state = 'ended', ended_at = v_now
        where id = v_room.id and state = 'running';
      end if;

      select r.* into v_room from public.rooms r where r.id = v_room.id;
    end if;
  end if;

  if v_room.state = 'running'
     and v_room.question_started_at is not null
     and v_now >= v_room.question_started_at
     and v_room.current_question_index >= 0
     and v_room.current_question_index < v_question_count then
    v_entry := v_questions -> v_room.current_question_index;
    v_question := coalesce(v_entry->'question', '{}'::jsonb);
    v_current_diff := coalesce(v_question->>'difficulty', 'easy');
    v_current_limit_s := public.game_time_limit_for_difficulty(v_current_diff);

    select exists (
      select 1 from public.submissions s
      where s.room_id = v_room.id
        and s.room_participant_id = v_participant.id
        and s.question_id = (v_question->>'id')::uuid
    ) into v_answer_submitted;

    v_question := jsonb_build_object(
      'id', v_question->>'id',
      'position', coalesce(v_entry->>'position', '0'),
      'question_text', v_question->>'question_text',
      'difficulty', v_question->>'difficulty',
      'explanation_timing', coalesce(v_entry->>'explanation_timing', 'never'),
      'options', coalesce(v_question->'options', '[]'::jsonb),
      'media', coalesce(v_question->'media', '[]'::jsonb),
      'time_limit_seconds', v_current_limit_s
    );
  else
    v_question := null;
    v_answer_submitted := false;
  end if;

  return query
  select
    v_room.id,
    v_room.code,
    coalesce(v_game->>'name', 'لعبة'),
    v_room.state,
    v_participant.id,
    coalesce(
      (select s.name from public.students s where s.id = v_participant.student_id),
      v_participant.guest_name
    ),
    (select count(*)::integer from public.room_participants rp2 where rp2.room_id = v_room.id),
    v_room.capacity,
    coalesce((v_game->>'duration_seconds')::integer, 60),
    v_room.current_question_index,
    v_question_count,
    v_room.question_started_at,
    v_question,
    v_answer_submitted,
    v_now;
end;
$$;

create function public.submit_game_answer(
  p_join_token uuid,
  p_question_id uuid,
  p_selected_option_id text
)
returns table (
  accepted boolean,
  is_correct boolean,
  score_awarded integer,
  response_time_ms integer,
  room_state text,
  next_question_index integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
  v_entry jsonb;
  v_question jsonb;
  v_option jsonb;
  v_questions jsonb;
  v_correct_option_key text;
  v_difficulty text;
  v_is_correct boolean;
  v_response_time_ms integer;
  v_time_limit_s integer;
  v_score integer;
  v_question_id uuid;
  v_participant_count integer;
  v_answered_count integer;
  v_now timestamptz := clock_timestamp();
begin
  select r.*
    into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token
  for update of r;

  if not found then
    raise exception 'INVALID_JOIN_TOKEN';
  end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  if v_room.state <> 'running' then
    raise exception 'GAME_NOT_RUNNING';
  end if;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  if v_room.current_question_index < 0
     or v_room.current_question_index >= jsonb_array_length(v_questions) then
    raise exception 'INVALID_QUESTION_INDEX';
  end if;

  v_entry := v_questions -> v_room.current_question_index;
  v_question := coalesce(v_entry->'question', '{}'::jsonb);
  v_question_id := (v_question->>'id')::uuid;

  if p_question_id <> v_question_id then
    raise exception 'QUESTION_NOT_CURRENT';
  end if;

  if v_room.question_started_at is null or v_now < v_room.question_started_at then
    raise exception 'QUESTION_NOT_STARTED';
  end if;

  v_difficulty := coalesce(v_question->>'difficulty', 'easy');
  v_time_limit_s := public.game_time_limit_for_difficulty(v_difficulty);

  if v_now >= v_room.question_started_at + (v_time_limit_s || ' seconds')::interval then
    raise exception 'QUESTION_TIMEOUT';
  end if;

  if exists (
    select 1 from public.submissions s
    where s.room_id = v_room.id
      and s.room_participant_id = v_participant.id
      and s.question_id = v_question_id
  ) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

  select opt into v_option
  from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb)) opt
  where opt->>'id' = p_selected_option_id
  limit 1;

  if v_option is null then
    raise exception 'INVALID_OPTION';
  end if;

  v_correct_option_key := v_question->>'correct_option_key';
  v_is_correct := (v_option->>'option_key') = v_correct_option_key;
  v_response_time_ms := floor(
    extract(epoch from (v_now - v_room.question_started_at)) * 1000
  )::integer;
  v_response_time_ms := greatest(0, least(v_time_limit_s * 1000, v_response_time_ms));
  v_score := case
    when v_is_correct then public.game_weight_for_difficulty(v_difficulty)
    else 0
  end;

  begin
    insert into public.submissions (
      room_id, room_participant_id, question_id, selected_option_id,
      is_correct, response_time_ms, score_awarded, submitted_at
    ) values (
      v_room.id, v_participant.id, v_question_id, p_selected_option_id,
      v_is_correct, v_response_time_ms, v_score, v_now
    );
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  select count(*)::integer into v_participant_count
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.joined_at <= v_room.question_started_at;

  select count(*)::integer into v_answered_count
  from public.submissions s
  where s.room_id = v_room.id and s.question_id = v_question_id;

  if v_answered_count >= v_participant_count then
    if v_room.current_question_index + 1 < jsonb_array_length(v_questions) then
      update public.rooms
      set current_question_index = v_room.current_question_index + 1,
          question_started_at = v_now + interval '3 seconds'
      where id = v_room.id and state = 'running';

      return query
      select true, v_is_correct, v_score, v_response_time_ms,
             'running'::text, v_room.current_question_index + 1;
      return;
    end if;

    update public.rooms
    set state = 'ended', ended_at = v_now
    where id = v_room.id and state = 'running';

    return query
    select true, v_is_correct, v_score, v_response_time_ms,
           'ended'::text, v_room.current_question_index;
    return;
  end if;

  return query
  select true, v_is_correct, v_score, v_response_time_ms,
         'running'::text, v_room.current_question_index;
end;
$$;

create function public.get_room_leaderboard_student(p_join_token uuid)
returns table (
  participant_id uuid,
  participant_name text,
  is_self boolean,
  answered_count integer,
  correct_count integer,
  weighted_correct integer,
  weighted_total integer,
  avg_response_ms integer,
  final_score integer,
  rnk integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
  v_questions jsonb;
  v_total_weight integer;
  v_avg_limit_ms integer;
begin
  select r.* into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token;

  if not found then
    raise exception 'INVALID_JOIN_TOKEN';
  end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_total_weight := public.game_total_weight(v_questions);
  v_avg_limit_ms := public.game_avg_limit_ms(v_questions);

  return query
  with stats as (
    select
      rp.id as p_id,
      coalesce(
        (select s.name from public.students s where s.id = rp.student_id),
        rp.guest_name,
        'طالب'
      ) as p_name,
      count(s.id)::int as answered_count,
      sum(case when s.is_correct then 1 else 0 end)::int as correct_count,
      coalesce(sum(s.score_awarded), 0)::int as weighted_correct,
      coalesce(avg(s.response_time_ms), v_avg_limit_ms)::int as avg_resp
    from public.room_participants rp
    left join public.submissions s
      on s.room_participant_id = rp.id and s.room_id = v_room.id
    where rp.room_id = v_room.id
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
    r.p_id, r.p_name,
    (r.p_id = v_participant.id) as is_self,
    r.answered_count, r.correct_count, r.weighted_correct,
    v_total_weight, r.avg_resp, r.fscore, r.rnk
  from ranked r
  order by r.rnk;
end;
$$;

create function public.get_room_leaderboard_teacher(p_room_id uuid)
returns table (
  participant_id uuid,
  participant_name text,
  is_self boolean,
  answered_count integer,
  correct_count integer,
  weighted_correct integer,
  weighted_total integer,
  avg_response_ms integer,
  final_score integer,
  rnk integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_questions jsonb;
  v_total_weight integer;
  v_avg_limit_ms integer;
begin
  select r.* into v_room from public.rooms r where r.id = p_room_id;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_total_weight := public.game_total_weight(v_questions);
  v_avg_limit_ms := public.game_avg_limit_ms(v_questions);

  return query
  with stats as (
    select
      rp.id as p_id,
      coalesce(
        (select s.name from public.students s where s.id = rp.student_id),
        rp.guest_name,
        'طالب'
      ) as p_name,
      count(s.id)::int as answered_count,
      sum(case when s.is_correct then 1 else 0 end)::int as correct_count,
      coalesce(sum(s.score_awarded), 0)::int as weighted_correct,
      coalesce(avg(s.response_time_ms), v_avg_limit_ms)::int as avg_resp
    from public.room_participants rp
    left join public.submissions s
      on s.room_participant_id = rp.id and s.room_id = v_room.id
    where rp.room_id = v_room.id
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
    r.p_id, r.p_name,
    false as is_self,
    r.answered_count, r.correct_count, r.weighted_correct,
    v_total_weight, r.avg_resp, r.fscore, r.rnk
  from ranked r
  order by r.rnk;
end;
$$;

revoke all on function public.get_game_session(uuid) from public;
grant execute on function public.get_game_session(uuid) to anon, authenticated;
revoke all on function public.submit_game_answer(uuid, uuid, text) from public;
grant execute on function public.submit_game_answer(uuid, uuid, text) to anon, authenticated;
revoke all on function public.get_room_leaderboard_student(uuid) from public;
grant execute on function public.get_room_leaderboard_student(uuid) to anon, authenticated;
revoke all on function public.get_room_leaderboard_teacher(uuid) from public;
grant execute on function public.get_room_leaderboard_teacher(uuid) to authenticated;