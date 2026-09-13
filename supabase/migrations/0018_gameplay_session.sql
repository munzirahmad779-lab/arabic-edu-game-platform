-- Phase 5 gameplay session: authoritative question state and server-side scoring.
-- Patch rev 2: countdown protection, participant filtering, server_time.

alter table public.rooms
  add column if not exists current_question_index integer not null default 0,
  add column if not exists question_started_at timestamptz;

-- Idempotent: drop dulu supaya bisa re-apply walau 0018 versi lama sudah jalan.
drop function if exists public.get_game_session(uuid);
drop function if exists public.submit_game_answer(uuid, uuid, text);

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

  select rp.*
    into v_participant
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
     and v_now >= v_room.question_started_at + interval '15 seconds' then
    if v_room.current_question_index + 1 < v_question_count then
      update public.rooms
      set
        current_question_index = v_room.current_question_index + 1,
        question_started_at = v_now + interval '3 seconds'
      where id = v_room.id
        and state = 'running';
    else
      update public.rooms
      set
        state = 'ended',
        ended_at = v_now
      where id = v_room.id
        and state = 'running';
    end if;

    select r.*
      into v_room
    from public.rooms r
    where r.id = v_room.id;
  end if;

  -- Soal hanya dibuka SETELAH countdown selesai.
  if v_room.state = 'running'
     and v_room.question_started_at is not null
     and v_now >= v_room.question_started_at
     and v_room.current_question_index >= 0
     and v_room.current_question_index < v_question_count then
    v_entry := v_questions -> v_room.current_question_index;
    v_question := coalesce(v_entry->'question', '{}'::jsonb);

    select exists (
      select 1
      from public.submissions s
      where s.room_id = v_room.id
        and s.room_participant_id = v_participant.id
        and s.question_id = (v_question->>'id')::uuid
    )
    into v_answer_submitted;

    v_question := jsonb_build_object(
      'id', v_question->>'id',
      'position', coalesce(v_entry->>'position', '0'),
      'question_text', v_question->>'question_text',
      'difficulty', v_question->>'difficulty',
      'explanation_timing', coalesce(v_entry->>'explanation_timing', 'never'),
      'options', coalesce(v_question->'options', '[]'::jsonb),
      'media', coalesce(v_question->'media', '[]'::jsonb)
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
    (select count(*)::integer
       from public.room_participants rp2
      where rp2.room_id = v_room.id),
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
  v_is_correct boolean;
  v_response_time_ms integer;
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

  select rp.*
    into v_participant
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

  if v_room.question_started_at is null then
    raise exception 'QUESTION_NOT_STARTED';
  end if;

  -- FIX KRITIS: tolak submit saat countdown belum selesai.
  if v_now < v_room.question_started_at then
    raise exception 'QUESTION_NOT_STARTED';
  end if;

  if v_now >= v_room.question_started_at + interval '15 seconds' then
    raise exception 'QUESTION_TIMEOUT';
  end if;

  if exists (
    select 1
    from public.submissions s
    where s.room_id = v_room.id
      and s.room_participant_id = v_participant.id
      and s.question_id = v_question_id
  ) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

  select opt
    into v_option
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
  v_response_time_ms := greatest(0, least(15000, v_response_time_ms));
  v_score := case
    when v_is_correct
      then 100 + greatest(0, floor((15000 - v_response_time_ms) / 300))::integer
    else 0
  end;

  begin
    insert into public.submissions (
      room_id,
      room_participant_id,
      question_id,
      selected_option_id,
      is_correct,
      response_time_ms,
      score_awarded,
      submitted_at
    )
    values (
      v_room.id,
      v_participant.id,
      v_question_id,
      p_selected_option_id,
      v_is_correct,
      v_response_time_ms,
      v_score,
      v_now
    );
  exception
    when unique_violation then
      raise exception 'ALREADY_SUBMITTED';
  end;

  -- FIX: hanya hitung peserta yang sudah join SEBELUM soal ini dimulai,
  -- supaya auto-advance tidak nyangkut karena late-joiner.
  select count(*)::integer into v_participant_count
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.joined_at <= v_room.question_started_at;

  select count(*)::integer into v_answered_count
  from public.submissions s
  where s.room_id = v_room.id
    and s.question_id = v_question_id;

  if v_answered_count >= v_participant_count then
    if v_room.current_question_index + 1 < jsonb_array_length(v_questions) then
      update public.rooms
      set
        current_question_index = v_room.current_question_index + 1,
        question_started_at = v_now + interval '3 seconds'
      where id = v_room.id
        and state = 'running';

      return query
      select true, v_is_correct, v_score, v_response_time_ms,
             'running'::text, v_room.current_question_index + 1;
      return;
    end if;

    update public.rooms
    set
      state = 'ended',
      ended_at = v_now
    where id = v_room.id
      and state = 'running';

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

revoke all on function public.get_game_session(uuid) from public;
grant execute on function public.get_game_session(uuid) to anon, authenticated;

revoke all on function public.submit_game_answer(uuid, uuid, text) from public;
grant execute on function public.submit_game_answer(uuid, uuid, text) to anon, authenticated;