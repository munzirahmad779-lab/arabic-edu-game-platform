-- 0057_room_controls_and_hardening.sql
-- 1. Kontrol langsung guru saat room berjalan:
--    - teacher_advance_room_question: lompat ke soal berikutnya atau akhiri room jika soal habis.
--    - teacher_end_room_game: akhiri permainan secara langsung dari dashboard guru.
-- 2. Hardening submit_game_answer untuk mode kooperatif:
--    - Peserta yang tidak aktif (heartbeat > 75 detik lalu) tidak memblokir kemajuan room.

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

  if v_room.teacher_id <> auth.uid() then
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

  if v_room.teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  update public.rooms
  set state = 'ended',
      ended_at = v_now
  where id = v_room.id and state in ('waiting', 'running');

  return true;
end;
$$;

revoke all on function public.teacher_advance_room_question(uuid) from public;
grant execute on function public.teacher_advance_room_question(uuid) to authenticated;

revoke all on function public.teacher_end_room_game(uuid) from public;
grant execute on function public.teacher_end_room_game(uuid) to authenticated;

-- Perbarui submit_game_answer agar mode kooperatif tidak deadlock saat siswa disconnect
create or replace function public.submit_game_answer(
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
  v_mode text;
  v_duration_s int;
begin
  select r.* into v_room
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.join_token = p_join_token
  for update of r;

  if not found then raise exception 'INVALID_JOIN_TOKEN'; end if;

  select rp.* into v_participant
  from public.room_participants rp
  where rp.join_token = p_join_token;

  if v_room.state <> 'running' then raise exception 'GAME_NOT_RUNNING'; end if;

  v_mode := coalesce(v_room.snapshot->'game'->>'mode', 'competitive');
  v_duration_s := coalesce((v_room.snapshot->'game'->>'duration_seconds')::int, 300);

  -- Cooperative: cek total timeout
  if v_mode = 'cooperative' then
    if v_room.started_at is null or v_now >= v_room.started_at + (v_duration_s || ' seconds')::interval then
      raise exception 'GAME_TIMEOUT';
    end if;
  end if;

  v_questions := coalesce(v_room.snapshot->'questions', '[]'::jsonb);
  if v_room.current_question_index < 0
     or v_room.current_question_index >= jsonb_array_length(v_questions) then
    raise exception 'INVALID_QUESTION_INDEX';
  end if;

  v_entry := v_questions -> v_room.current_question_index;
  v_question := coalesce(v_entry->'question', '{}'::jsonb);
  v_question_id := (v_question->>'id')::uuid;

  if p_question_id <> v_question_id then raise exception 'QUESTION_NOT_CURRENT'; end if;

  if v_room.question_started_at is null or v_now < v_room.question_started_at then
    raise exception 'QUESTION_NOT_STARTED';
  end if;

  v_difficulty := coalesce(v_question->>'difficulty', 'easy');
  v_time_limit_s := public.game_time_limit_for_difficulty(v_difficulty);

  -- Cooperative: tidak ada per-question timeout
  if v_mode <> 'cooperative' then
    if v_now >= v_room.question_started_at + (v_time_limit_s || ' seconds')::interval then
      raise exception 'QUESTION_TIMEOUT';
    end if;
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

  if v_option is null then raise exception 'INVALID_OPTION'; end if;

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

  -- Hitung peserta aktif (hanya yang heartbeat dalam 75 detik terakhir dan sudah bergabung sebelum soal dimulai)
  select count(*)::integer into v_participant_count
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.joined_at <= v_room.question_started_at
    and rp.last_seen_at >= v_now - interval '75 seconds';

  -- Jika tidak ada data peserta aktif (misal jitter), fallback ke minimal 1
  if v_participant_count < 1 then
    v_participant_count := 1;
  end if;

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

revoke all on function public.submit_game_answer(uuid, uuid, text) from public;
grant execute on function public.submit_game_answer(uuid, uuid, text) to anon, authenticated;
