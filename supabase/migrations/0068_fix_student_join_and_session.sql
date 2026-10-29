-- ============================================================================
-- Migration 0068: Perbaikan rantai join siswa (akar masalah "siswa tidak bisa
-- terhubung saat join room")
--
-- 1. get_game_session: migrasi 0062/0063/0064/0067 membaca
--    v_room.participant_count, padahal tabel rooms TIDAK punya kolom itu
--    (0001 + alter 0018 tidak pernah menambahkannya). Di PL/pgSQL, akses field
--    %rowtype yang tidak ada = error runtime pada SETIAP panggilan yang
--    pesertanya ditemukan, sehingga route sesi siswa selalu gagal di langkah
--    otoritatifnya. Di sini participant_count dihitung dari room_participants
--    (pola yang sama dengan join_room & get_join_session). Isi fungsi lain
--    identik 0067.
-- 2. join_room: terima gabung saat state 'waiting' ATAU 'running' (siswa telat
--    tidak lagi ditolak ROOM_NOT_OPEN), dan gabung ulang bersifat idempoten:
--    peserta yang sudah terdaftar menerima kembali join_token miliknya
--    (sesudah validasi roster + PIN untuk room kelas), bukan ALREADY_JOINED.
-- 3. reconnect_room_participant: jalur pemulihan resmi SECURITY DEFINER untuk
--    siswa yang join_token-nya hilang. Menggantikan query tabel langsung
--    sebagai anon yang selalu ditolak RLS (0002: semua policy rooms /
--    room_participants / students hanya untuk authenticated pemilik).
--    Room kelas: hanya mengembalikan peserta yang SUDAH terdaftar (PIN sudah
--    terbukti saat join pertama); tidak pernah membuat peserta baru.
--    Room ad-hoc: peserta lama menurut nama, atau dibuat bila belum ada.
-- 4. reset_room_session: reset room lewat SECURITY DEFINER. Route kontrol
--    sebelumnya menghapus submissions memakai klien RLS guru; tabel
--    submissions tidak punya policy DELETE untuk peran mana pun (0002),
--    sehingga jawaban siswa tidak pernah terhapus di DB dan indeks soal
--    siswa (dihitung get_game_session dari submissions) tidak kembali ke 1.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. get_game_session (identik 0067, satu ekspresi diperbaiki)
-- ------------------------------------------------------------
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
    (select count(*)::integer from public.room_participants rp_count where rp_count.room_id = v_room.id) as participant_count,
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

-- ------------------------------------------------------------
-- 2. join_room (basis 0019, state waiting|running + rejoin idempoten)
-- ------------------------------------------------------------
create or replace function public.join_room(
  p_code text,
  p_name text,
  p_pin text default null
)
returns table (
  room_id uuid,
  room_code text,
  game_name text,
  class_id uuid,
  participant_id uuid,
  participant_name text,
  join_token uuid,
  participant_count integer,
  capacity integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_student public.students%rowtype;
  v_participant public.room_participants%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_pin text := btrim(coalesce(p_pin, ''));
  v_count integer;
begin
  if v_code = '' or char_length(v_code) <> 6 then
    raise exception 'INVALID_ROOM_CODE';
  end if;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  select *
  into v_room
  from public.rooms
  where upper(code) = v_code
  limit 1
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.state not in ('waiting', 'running') then
    raise exception 'ROOM_NOT_OPEN';
  end if;

  -- Class-scoped room: PIN is mandatory.
  if v_room.class_id is not null then
    if v_pin = '' then
      raise exception 'PIN_REQUIRED';
    end if;

    select s.*
    into v_student
    from public.students s
    where s.class_id = v_room.class_id
      and lower(btrim(s.name)) = lower(v_name)
    limit 1;

    if not found then
      raise exception 'STUDENT_NOT_FOUND';
    end if;

    if crypt(v_pin, v_student.pin_hash) <> v_student.pin_hash then
      raise exception 'INVALID_PIN';
    end if;

    select rp.*
    into v_participant
    from public.room_participants rp
    where rp.room_id = v_room.id
      and rp.student_id = v_student.id
    limit 1;

    if not found then
      select count(*)::integer
      into v_count
      from public.room_participants rp
      where rp.room_id = v_room.id;

      if v_count >= v_room.capacity then
        raise exception 'ROOM_FULL';
      end if;

      insert into public.room_participants (
        room_id,
        student_id,
        connection_state,
        join_token
      )
      values (
        v_room.id,
        v_student.id,
        'connected',
        gen_random_uuid()
      )
      returning * into v_participant;
    end if;

  else
    -- Ad-hoc room: guest join remains available (idempotent per nama).
    select rp.*
    into v_participant
    from public.room_participants rp
    where rp.room_id = v_room.id
      and rp.guest_name is not null
      and lower(btrim(rp.guest_name)) = lower(v_name)
    limit 1;

    if not found then
      select count(*)::integer
      into v_count
      from public.room_participants rp
      where rp.room_id = v_room.id;

      if v_count >= v_room.capacity then
        raise exception 'ROOM_FULL';
      end if;

      insert into public.room_participants (
        room_id,
        guest_name,
        connection_state,
        join_token
      )
      values (
        v_room.id,
        v_name,
        'connected',
        gen_random_uuid()
      )
      returning * into v_participant;
    end if;
  end if;

  select count(*)::integer
  into v_count
  from public.room_participants rp
  where rp.room_id = v_room.id;

  return query
  select
    v_room.id,
    v_room.code,
    coalesce(v_room.snapshot->'game'->>'name', 'لعبة'),
    v_room.class_id,
    v_participant.id,
    coalesce(v_student.name, v_participant.guest_name),
    v_participant.join_token,
    v_count,
    v_room.capacity;
end;
$$;

revoke all on function public.join_room(text, text, text) from public, anon;
grant execute on function public.join_room(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. reconnect_room_participant
-- ------------------------------------------------------------
drop function if exists public.reconnect_room_participant(text, text);

create function public.reconnect_room_participant(
  p_code text,
  p_name text
)
returns table (
  room_id uuid,
  room_state text,
  participant_id uuid,
  join_token uuid,
  participant_name text,
  snapshot jsonb,
  capacity integer,
  started_at timestamptz,
  question_started_at timestamptz,
  current_question_index integer,
  question_index integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_student public.students%rowtype;
  v_participant public.room_participants%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_count integer;
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

  if v_room.class_id is not null then
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
  end if;

  select rp.*
  into v_participant
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.guest_name is not null
    and lower(btrim(rp.guest_name)) = lower(v_name)
  limit 1;

  if not found then
    if v_room.state not in ('waiting', 'running') then
      return;
    end if;

    select count(*)::integer
    into v_count
    from public.room_participants rp
    where rp.room_id = v_room.id;

    if v_count >= v_room.capacity then
      return;
    end if;

    insert into public.room_participants (
      room_id,
      guest_name,
      connection_state,
      join_token
    )
    values (
      v_room.id,
      nullif(v_name, ''),
      'connected',
      gen_random_uuid()
    )
    returning * into v_participant;
  end if;

  return query
  select v_room.id, v_room.state, v_participant.id, v_participant.join_token,
         v_participant.guest_name, v_room.snapshot,
         v_room.capacity, v_room.started_at, v_room.question_started_at,
         v_room.current_question_index,
         (select count(*)::integer from public.submissions s
           where s.room_id = v_room.id and s.room_participant_id = v_participant.id);
end;
$$;

revoke all on function public.reconnect_room_participant(text, text) from public;
grant execute on function public.reconnect_room_participant(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. reset_room_session
-- ------------------------------------------------------------
drop function if exists public.reset_room_session(uuid);

create function public.reset_room_session(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select *
  into v_room
  from public.rooms
  where id = p_room_id;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.submissions
  where room_id = p_room_id;

  update public.rooms
  set state = 'running',
      current_question_index = 0,
      started_at = v_now,
      question_started_at = v_now + interval '2 seconds',
      ended_at = null
  where id = p_room_id;

  return p_room_id;
end;
$$;

revoke all on function public.reset_room_session(uuid) from public;
grant execute on function public.reset_room_session(uuid) to authenticated;

-- Reload schema cache in PostgREST
notify pgrst, 'reload schema';
