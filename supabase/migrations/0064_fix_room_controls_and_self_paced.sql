-- 0064_fix_room_controls_and_self_paced.sql
-- Fixes:
-- 1. Restores and grants public.teacher_end_room_game and public.teacher_advance_room_question
-- 2. Corrects submissions column name (score_awarded instead of score) in get_game_session and submit_game_answer
-- 3. Eliminates table row-locking (for update) in get_game_session to prevent deadlock / statement timeouts during concurrent student polling
-- 4. Reloads PostgREST schema cache

-- ============================================================================
-- 1. Teacher Live Controls RPCs
-- ============================================================================

create or replace function public.teacher_advance_room_question(p_room_id uuid)
returns table (
  room_state text,
  next_question_index integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_questions jsonb;
  v_q_count int;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.teacher_id <> (select auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  if v_room.state <> 'running' then
    return query select v_room.state, v_room.current_question_index;
    return;
  end if;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_q_count := jsonb_array_length(v_questions);

  if v_room.current_question_index + 1 < v_q_count then
    update public.rooms
    set current_question_index = v_room.current_question_index + 1,
        question_started_at = v_now + interval '3 seconds'
    where id = v_room.id and state = 'running';

    return query select 'running'::text, v_room.current_question_index + 1;
  else
    update public.rooms
    set state = 'ended',
        ended_at = v_now
    where id = v_room.id and state = 'running';

    return query select 'ended'::text, v_room.current_question_index;
  end if;
end;
$$;

create or replace function public.teacher_end_room_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.teacher_id <> (select auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  if v_room.state = 'running' then
    update public.rooms
    set state = 'ended',
        ended_at = v_now
    where id = v_room.id;
  end if;

  return true;
end;
$$;

revoke all on function public.teacher_advance_room_question(uuid) from public, anon;
grant execute on function public.teacher_advance_room_question(uuid) to authenticated;

revoke all on function public.teacher_end_room_game(uuid) from public, anon;
grant execute on function public.teacher_end_room_game(uuid) to authenticated;

-- ============================================================================
-- 2. get_game_session (Self-Paced with score_awarded & lock-free polling)
-- ============================================================================

drop function if exists public.get_game_session(uuid);

create function public.get_game_session(p_join_token uuid)
returns table (
  room_id uuid,
  room_code text,
  game_name text,
  game_type text,
  game_mode text,
  game_duration_seconds integer,
  started_at timestamptz,
  room_state text,
  participant_id uuid,
  participant_name text,
  participant_count integer,
  capacity integer,
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
  v_game_type text;
  v_mode text;
  v_duration_s int;
  v_current_diff text;
  v_current_limit_s int;
  v_user_q_index int;
  v_user_q_started_at timestamptz;
  v_return_state text;
  v_active_count int;
  v_all_finished boolean;
begin
  -- Lock-free read to avoid queuing and statement timeout during concurrent student polling
  select r.*
    into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token;

  if not found then
    raise exception 'INVALID_JOIN_TOKEN';
  end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  v_game := coalesce(v_room.snapshot->'game', '{}'::jsonb);
  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_question_count := jsonb_array_length(v_questions);
  v_mode := coalesce(v_game->>'mode', 'competitive');

  -- Legacy game_type resolution
  if v_game->>'game_type' = 'arabic_chase_race' then
    if v_mode = 'anagram' then
      v_game_type := 'anagram';
    elsif v_mode = 'matching' then
      v_game_type := 'matching';
    else
      v_game_type := 'runner';
    end if;
  else
    v_game_type := coalesce(
      v_game->>'game_type',
      case when v_mode = 'anagram' then 'anagram' else 'quiz' end
    );
  end if;

  v_duration_s := coalesce((v_game->>'duration_seconds')::int, 300);

  if v_question_count < 1 then
    raise exception 'ROOM_HAS_NO_QUESTIONS';
  end if;

  -- MODE COOPERATIVE: total duration check
  if v_mode = 'cooperative' then
    if v_room.state = 'running'
       and v_room.started_at is not null
       and v_now >= v_room.started_at + (v_duration_s || ' seconds')::interval then
      update public.rooms
      set state = 'ended', ended_at = v_now
      where id = v_room.id and state = 'running';

      select r.* into v_room from public.rooms r where r.id = v_room.id;
    end if;
  end if;

  -- Participant question progress (self-paced)
  select count(*)::integer
    into v_user_q_index
  from public.submissions s
  where s.room_id = v_room.id
    and s.room_participant_id = v_participant.id;

  if v_user_q_index > 0 then
    select max(s.submitted_at)
      into v_user_q_started_at
    from public.submissions s
    where s.room_id = v_room.id
      and s.room_participant_id = v_participant.id;
  else
    v_user_q_started_at := coalesce(v_room.question_started_at, v_room.started_at, v_now);
  end if;

  -- Check if all active participants have completed all questions in competitive mode
  if v_mode <> 'cooperative' and v_room.state = 'running' then
    select count(*)::integer
      into v_active_count
    from public.room_participants rp
    where rp.room_id = v_room.id and rp.is_active = true;

    if v_active_count > 0 then
      select count(distinct fin.room_participant_id) = v_active_count
        into v_all_finished
      from (
        select s.room_participant_id
        from public.submissions s
        join public.room_participants rp on rp.id = s.room_participant_id
        where s.room_id = v_room.id and rp.is_active = true
        group by s.room_participant_id
        having count(*) >= v_question_count
      ) fin;

      if v_all_finished then
        update public.rooms
        set state = 'ended', ended_at = v_now
        where id = v_room.id and state = 'running';

        select r.* into v_room from public.rooms r where r.id = v_room.id;
      end if;
    end if;
  end if;

  v_return_state := v_room.state;

  -- Question resolution for participant
  if v_room.state = 'running' then
    if v_user_q_index >= v_question_count then
      v_question := null;
      v_answer_submitted := true;
      v_return_state := 'ended';
    else
      v_entry := v_questions -> v_user_q_index;
      v_question := coalesce(v_entry->'question', '{}'::jsonb);
      v_current_diff := coalesce(v_question->>'difficulty', 'easy');
      v_current_limit_s := public.game_time_limit_for_difficulty(v_current_diff);

      -- Check question timeout in competitive mode
      if v_mode <> 'cooperative'
         and v_user_q_started_at is not null
         and v_now >= v_user_q_started_at + (v_current_limit_s || ' seconds')::interval then
        -- Automatically record timeout submission with score_awarded = 0
        if (v_question->>'id') is not null then
          insert into public.submissions (
            room_id,
            room_participant_id,
            question_id,
            selected_option_id,
            answer_text,
            is_correct,
            response_time_ms,
            score_awarded,
            submitted_at
          ) values (
            v_room.id,
            v_participant.id,
            (v_question->>'id')::uuid,
            null,
            null,
            false,
            v_current_limit_s * 1000,
            0,
            v_now
          ) on conflict (room_participant_id, question_id) do nothing;
        end if;

        v_user_q_index := v_user_q_index + 1;
        v_user_q_started_at := v_now;

        if v_user_q_index >= v_question_count then
          v_question := null;
          v_answer_submitted := true;
          v_return_state := 'ended';
        else
          v_entry := v_questions -> v_user_q_index;
          v_question := coalesce(v_entry->'question', '{}'::jsonb);
          v_answer_submitted := false;
        end if;
      else
        v_answer_submitted := false;
      end if;
    end if;
  else
    v_question := null;
    v_answer_submitted := false;
  end if;

  return query
  select
    v_room.id as room_id,
    v_room.code as room_code,
    coalesce(v_game->>'name', 'Game') as game_name,
    v_game_type as game_type,
    v_mode as game_mode,
    v_duration_s as game_duration_seconds,
    v_room.started_at as started_at,
    v_return_state as room_state,
    v_participant.id as participant_id,
    v_participant.student_name as participant_name,
    v_room.participant_count as participant_count,
    v_room.capacity as capacity,
    v_user_q_index as question_index,
    v_question_count as question_count,
    v_user_q_started_at as question_started_at,
    case
      when v_question is not null then
        jsonb_build_object(
          'id', v_question->>'id',
          'question_text', v_question->>'question_text',
          'difficulty', v_question->>'difficulty',
          'options', coalesce(v_question->'options', '[]'::jsonb),
          'media', coalesce(v_question->'media', '[]'::jsonb),
          'time_limit_seconds', public.game_time_limit_for_difficulty(coalesce(v_question->>'difficulty', 'easy'))
        )
      else null
    end as question,
    v_answer_submitted as answer_submitted,
    v_now as server_time;
end;
$$;

revoke all on function public.get_game_session(uuid) from public;
grant execute on function public.get_game_session(uuid) to anon, authenticated;

-- ============================================================================
-- 3. submit_game_answer (Self-Paced with score_awarded)
-- ============================================================================

create or replace function public.submit_game_answer(
  p_join_token uuid,
  p_question_id uuid,
  p_selected_option_id text default null,
  p_answer_text text default null
)
returns table (
  accepted boolean,
  is_correct boolean,
  score_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
  v_questions jsonb;
  v_question jsonb;
  v_entry jsonb;
  v_user_q_index int;
  v_user_q_started_at timestamptz;
  v_question_id uuid;
  v_difficulty text;
  v_correct_option_key text;
  v_correct_option jsonb;
  v_correct_answer_text text;
  v_option jsonb;
  v_is_correct boolean;
  v_now timestamptz := clock_timestamp();
  v_time_limit_s int;
  v_response_time_ms int;
  v_score int := 0;
  v_all_answered boolean;
  v_active_count int;
  v_game jsonb;
  v_mode text;
  v_game_type text;
  v_duration_s int;
  v_answer_text text;
begin
  select rp.*
    into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  if not found then
    raise exception 'INVALID_JOIN_TOKEN';
  end if;

  select r.*
    into v_room
  from public.rooms r
  where r.id = v_participant.room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.state <> 'running' then
    return query select false, false, 0;
    return;
  end if;

  v_game := coalesce(v_room.snapshot->'game', '{}'::jsonb);
  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  v_mode := coalesce(v_game->>'mode', 'competitive');
  v_duration_s := coalesce((v_game->>'duration_seconds')::int, 300);

  if v_game->>'game_type' = 'arabic_chase_race' then
    if v_mode = 'anagram' then
      v_game_type := 'anagram';
    elsif v_mode = 'matching' then
      v_game_type := 'matching';
    else
      v_game_type := 'runner';
    end if;
  else
    v_game_type := coalesce(
      v_game->>'game_type',
      case when v_mode = 'anagram' then 'anagram' else 'quiz' end
    );
  end if;

  -- Cooperative total timer check
  if v_mode = 'cooperative' then
    if v_room.started_at is not null
       and v_now >= v_room.started_at + (v_duration_s || ' seconds')::interval then
      update public.rooms
      set state = 'ended', ended_at = v_now
      where id = v_room.id and state = 'running';

      return query select false, false, 0;
      return;
    end if;
  end if;

  -- Self-paced question index
  select count(*)::integer
    into v_user_q_index
  from public.submissions s
  where s.room_id = v_room.id
    and s.room_participant_id = v_participant.id;

  if v_user_q_index >= jsonb_array_length(v_questions) then
    return query select false, false, 0;
    return;
  end if;

  v_entry := v_questions -> v_user_q_index;
  v_question := coalesce(v_entry->'question', '{}'::jsonb);
  v_question_id := (v_question->>'id')::uuid;

  if v_question_id <> p_question_id then
    return query select false, false, 0;
    return;
  end if;

  if exists (
    select 1
    from public.submissions s
    where s.room_id = v_room.id
      and s.room_participant_id = v_participant.id
      and s.question_id = v_question_id
  ) then
    return query select false, false, 0;
    return;
  end if;

  v_difficulty := coalesce(v_question->>'difficulty', 'easy');
  v_time_limit_s := public.game_time_limit_for_difficulty(v_difficulty);

  if v_user_q_index > 0 then
    select max(s.submitted_at)
      into v_user_q_started_at
    from public.submissions s
    where s.room_id = v_room.id
      and s.room_participant_id = v_participant.id;
  else
    v_user_q_started_at := coalesce(v_room.question_started_at, v_room.started_at, v_now);
  end if;

  if v_mode <> 'cooperative' and v_user_q_started_at is not null then
    if v_now > (v_user_q_started_at + (v_time_limit_s || ' seconds')::interval + interval '1 second') then
      return query select false, false, 0;
      return;
    end if;
  end if;

  v_correct_option_key := coalesce(v_question->>'correct_option_key', '');

  -- Option evaluation or Text evaluation (Anagram)
  if v_game_type = 'anagram' then
    select opt
      into v_correct_option
    from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb)) opt
    where opt->>'option_key' = v_correct_option_key
    limit 1;

    v_answer_text := nullif(btrim(regexp_replace(coalesce(p_answer_text, ''), '\s+', ' ', 'g')), '');
    v_correct_answer_text := btrim(regexp_replace(coalesce(v_correct_option->>'option_text', ''), '\s+', ' ', 'g'));

    if length(v_correct_answer_text) = 0 then
      raise exception 'QUESTION_MISSING_CORRECT_ANSWER';
    end if;

    if v_answer_text is null then
      v_is_correct := false;
    else
      v_is_correct := lower(v_answer_text) = lower(v_correct_answer_text);
    end if;
  else
    if p_selected_option_id is null then
      raise exception 'INVALID_OPTION';
    end if;

    select opt
      into v_option
    from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb)) opt
    where opt->>'id' = p_selected_option_id
    limit 1;

    if v_option is null then
      raise exception 'INVALID_OPTION';
    end if;

    v_is_correct := v_option->>'option_key' = v_correct_option_key;
    v_answer_text := null;
  end if;

  v_response_time_ms := floor(extract(epoch from (v_now - v_user_q_started_at)) * 1000)::integer;
  if v_response_time_ms < 0 then
    v_response_time_ms := 0;
  elsif v_response_time_ms > (v_time_limit_s * 1000) then
    v_response_time_ms := v_time_limit_s * 1000;
  end if;

  v_score := public.calculate_question_score(v_difficulty, v_response_time_ms, v_is_correct);

  -- Insert submission with SCORE_AWARDED column
  insert into public.submissions (
    room_id,
    room_participant_id,
    question_id,
    selected_option_id,
    answer_text,
    is_correct,
    response_time_ms,
    score_awarded,
    submitted_at
  ) values (
    v_room.id,
    v_participant.id,
    v_question_id,
    p_selected_option_id,
    v_answer_text,
    v_is_correct,
    v_response_time_ms,
    v_score,
    v_now
  );

  update public.room_participants
  set score = score + v_score
  where id = v_participant.id;

  update public.rooms
  set current_question_index = greatest(current_question_index, v_user_q_index + 1)
  where id = v_room.id and current_question_index < v_user_q_index + 1;

  -- Check if all active participants have completed all questions
  select count(*)
    into v_active_count
  from public.room_participants rp
  where rp.room_id = v_room.id and rp.is_active = true;

  if v_active_count > 0 and v_mode <> 'cooperative' then
    select count(distinct fin.room_participant_id) = v_active_count
      into v_all_answered
    from (
      select s.room_participant_id
      from public.submissions s
      join public.room_participants rp on rp.id = s.room_participant_id
      where s.room_id = v_room.id and rp.is_active = true
      group by s.room_participant_id
      having count(*) >= jsonb_array_length(v_questions)
    ) fin;

    if v_all_answered then
      update public.rooms
      set state = 'ended', ended_at = v_now
      where id = v_room.id and state = 'running';
    end if;
  end if;

  return query select true, v_is_correct, v_score;
end;
$$;

revoke all on function public.submit_game_answer(uuid, uuid, text, text) from public;
grant execute on function public.submit_game_answer(uuid, uuid, text, text) to anon, authenticated;

-- Reload schema cache in PostgREST
notify pgrst, 'reload schema';
