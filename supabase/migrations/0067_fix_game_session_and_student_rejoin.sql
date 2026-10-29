-- ============================================================================
-- Migration 0065: Fix get_game_session participant_name lookup & allow student reconnect
-- ============================================================================

-- 1. Fix get_game_session (resolves v_participant.student_name bug)
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

      if v_mode <> 'cooperative'
         and v_user_q_started_at is not null
         and v_now >= v_user_q_started_at + (v_current_limit_s || ' seconds')::interval then
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
    coalesce(
      (select s.name from public.students s where s.id = v_participant.student_id),
      v_participant.guest_name
    ) as participant_name,
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

-- Reload schema cache in PostgREST
notify pgrst, 'reload schema';
