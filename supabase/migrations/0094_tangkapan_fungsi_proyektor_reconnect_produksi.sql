-- ============================================================================
-- 0094_tangkapan_fungsi_proyektor_reconnect_produksi.sql
-- Status: BERKAS TANGKAPAN (capture) — BUKAN untuk diterapkan ke produksi.
-- Definisi produksi proyek zwenvfoolgwlcjprnxlk diekspor baca-saja
-- 10 Nov 2026 tahap 16 (17:02-17:14 WITA). Dasar pembangunan 0087.
-- Catatan keaslian: pembacaan pertama press_projector_button sempat
-- menampilkan varian berbeda (TTL 90 detik di blok penolakan, ekor
-- event berbeda); kueri yang sama diulang dan teks di bawah adalah
-- hasil pengambilan segar yang konsisten di beberapa tampilan.
-- Fungsi projector lain yang ada di produksi: get_projector_room_state
-- (p_room_code), is_projector_room_active (p_room_code),
-- touch_projector_controller (p_room_code, p_team_id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.press_projector_button(p_room_code text, p_team_id text, p_player_name text, p_option_id text, p_option_key text, p_question_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
  v_key text := upper(trim(coalesce(p_option_key, 'A')));
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_state jsonb;
  v_gs jsonb;
  v_answers jsonb;
  v_room_q integer;
  v_event jsonb;
  v_events jsonb;
begin
  insert into public.projector_room_states (
    room_code, state, last_seen_at, expires_at, updated_at
  ) values (
    v_code,
    jsonb_build_object(
      'events', '[]'::jsonb,
      'heartbeats', '{}'::jsonb,
      'gameState', jsonb_build_object(
        'phase', 'lobby',
        'currentQuestionIndex', 0,
        'timerSeconds', 30,
        'totalQuestions', 1,
        'answeredTeams', '{}'::jsonb,
        'lastUpdated', v_now_ms
      )
    ),
    now(), now() + interval '60 seconds', now()
  )
  on conflict (room_code) do nothing;

  select prs.state
  into v_state
  from public.projector_room_states prs
  where prs.room_code = v_code
  for update;

  v_gs := coalesce(v_state -> 'gameState', '{}'::jsonb);
  v_answers := coalesce(v_gs -> 'answeredTeams', '{}'::jsonb);

  v_state := jsonb_set(
    v_state,
    '{heartbeats}',
    coalesce(v_state -> 'heartbeats', '{}'::jsonb)
    || jsonb_build_object(p_team_id, v_now_ms)
  );

  v_room_q := coalesce((v_gs ->> 'currentQuestionIndex')::integer, 0);

  if p_question_index is null or p_question_index <> v_room_q then
    update public.projector_room_states prs
      set state = v_state,
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'STALE_QUESTION',
      'existingAnswer', null
    );
  end if;

  if v_answers ? p_team_id then
    update public.projector_room_states prs
      set state = v_state,
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ANSWERED',
      'existingAnswer', v_answers -> p_team_id ->> 'optionKey'
    );
  end if;

  v_answers := v_answers || jsonb_build_object(
    p_team_id,
    jsonb_build_object('optionKey', v_key, 'timestamp', v_now_ms)
  );
  v_gs := jsonb_set(v_gs, '{answeredTeams}', v_answers);
  v_state := jsonb_set(v_state, '{gameState}', v_gs);

  v_event := jsonb_build_object(
    'id', 'evt-' || v_now_ms::text || '-'
      || substr(md5(random()::text || clock_timestamp()::text), 1, 4),
    'roomCode', v_code,
    'teamId', p_team_id,
    'playerName', coalesce(p_player_name, 'Pemain'),
    'optionId', p_option_id,
    'optionKey', v_key,
    'action', 'press',
    'timestamp', v_now_ms
  );

  select coalesce(
    jsonb_agg(e order by (e ->> 'timestamp')::bigint),
    '[]'::jsonb
  )
  into v_events
  from jsonb_array_elements(coalesce(v_state -> 'events', '[]'::jsonb)) as e
  where (e ->> 'timestamp')::bigint > v_now_ms - 60000;

  v_state := jsonb_set(
    v_state,
    '{events}',
    v_events || jsonb_build_array(v_event)
  );

  update public.projector_room_states prs
    set state = v_state,
      last_seen_at = now(),
      expires_at = now() + interval '60 seconds',
      updated_at = now()
    where prs.room_code = v_code;

  return jsonb_build_object(
    'success', true,
    'eventId', v_event ->> 'id',
    'optionKey', v_key,
    'timestamp', v_now_ms,
    'isLocked', true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconnect_room_participant(p_code text, p_name text)
 RETURNS TABLE(room_id uuid, room_state text, participant_id uuid, join_token uuid, participant_name text, snapshot jsonb, capacity integer, started_at timestamp with time zone, question_started_at timestamp with time zone, current_question_index integer, question_index integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_room public.rooms%rowtype;
  v_student public.students%rowtype;
  v_participant public.room_participants%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  select *
  into v_room
  from public.rooms
  where upper(code) = v_code
  limit 1;

  if not found then
    return;
  end if;

  if v_room.state = 'ended' then
    return query
      select v_room.id, v_room.state, null::uuid, null::uuid, null::text, v_room.snapshot,
      v_room.capacity, v_room.started_at, v_room.question_started_at,
      v_room.current_question_index, 0;
    return;
  end if;

  if v_room.class_id is null then
    return;
  end if;

  select s.*
  into v_student
  from public.students s
  where s.class_id = v_room.class_id
  and lower(btrim(s.name)) = lower(v_name)
  limit 1;

  if not found then
    return;
  end if;

  select rp.*
  into v_participant
  from public.room_participants rp
  where rp.room_id = v_room.id
  and rp.student_id = v_student.id
  limit 1;

  if not found then
    return;
  end if;

  return query
  select v_room.id, v_room.state, v_participant.id, v_participant.join_token,
    v_student.name, v_room.snapshot,
    v_room.capacity, v_room.started_at, v_room.question_started_at,
    v_room.current_question_index,
    (select count(*)::integer from public.submissions s
      where s.room_id = v_room.id and s.room_participant_id = v_participant.id);
  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_projector_room_state(p_room_code text, p_game_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
  v_existing_state jsonb;
  v_existing_expires timestamptz;
  v_existing_gs jsonb;
  v_merged_gs jsonb;
  v_new_state jsonb;
begin
  select prs.state, prs.expires_at
  into v_existing_state, v_existing_expires
  from public.projector_room_states prs
  where prs.room_code = v_code
  for update;

  v_merged_gs := p_game_state;

  if v_existing_state is not null and v_existing_expires > now() then
    v_existing_gs := v_existing_state -> 'gameState';

    if v_existing_gs is not null
    and (v_existing_gs ->> 'currentQuestionIndex') is not null
    and (v_existing_gs ->> 'currentQuestionIndex')
      = (p_game_state ->> 'currentQuestionIndex') then
      v_merged_gs := jsonb_set(
        p_game_state,
        '{answeredTeams}',
        coalesce(v_existing_gs -> 'answeredTeams', '{}'::jsonb)
        || coalesce(p_game_state -> 'answeredTeams', '{}'::jsonb)
      );
    end if;

    v_new_state := jsonb_set(
      v_existing_state,
      '{gameState}',
      v_merged_gs
    );
  else
    v_new_state := jsonb_build_object(
      'events', '[]'::jsonb,
      'heartbeats', '{}'::jsonb,
      'gameState', v_merged_gs
    );
  end if;

  insert into public.projector_room_states as prs (
    room_code, state, last_seen_at, expires_at, updated_at
  ) values (
    v_code, v_new_state, now(), now() + interval '60 seconds', now()
  )
  on conflict (room_code) do update
    set state = excluded.state,
      last_seen_at = excluded.last_seen_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;

  return v_merged_gs;
end;
$function$;
