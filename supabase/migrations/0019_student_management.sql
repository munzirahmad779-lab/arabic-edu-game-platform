-- 0018_student_management.sql
-- Student management for teachers.
-- PIN is always stored as a bcrypt hash, never plaintext.

create extension if not exists pgcrypto;

revoke all on table public.students from anon;
revoke all on table public.students from authenticated;
grant select on table public.students to authenticated;

-- ------------------------------------------------------------
-- Create student
-- ------------------------------------------------------------
create or replace function public.create_student(
  p_class_id uuid,
  p_name text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_pin text := btrim(coalesce(p_pin, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  if v_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN_FORMAT';
  end if;

  if not exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.students s
    where s.class_id = p_class_id
      and lower(btrim(s.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  insert into public.students (
    class_id,
    name,
    pin_hash
  )
  values (
    p_class_id,
    v_name,
    crypt(v_pin, gen_salt('bf'))
  )
  returning id into v_student_id;

  return v_student_id;
end;
$$;

-- ------------------------------------------------------------
-- Reset student PIN
-- ------------------------------------------------------------
create or replace function public.reset_student_pin(
  p_student_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN_FORMAT';
  end if;

  if not exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  update public.students
  set
    pin_hash = crypt(p_pin, gen_salt('bf')),
    updated_at = now()
  where id = p_student_id;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- Delete student
-- ------------------------------------------------------------
create or replace function public.delete_student(
  p_student_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  delete from public.students
  where id = p_student_id;

  return true;
end;
$$;

revoke all on function public.create_student(uuid, text, text) from public, anon;
grant execute on function public.create_student(uuid, text, text) to authenticated;

revoke all on function public.reset_student_pin(uuid, text) from public, anon;
grant execute on function public.reset_student_pin(uuid, text) to authenticated;

revoke all on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;

-- ------------------------------------------------------------
-- Make class rooms require a registered student PIN.
-- Guest mode remains available for rooms without class_id.
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

  if v_room.state <> 'waiting' then
    raise exception 'ROOM_NOT_OPEN';
  end if;

  select count(*)::integer
  into v_count
  from public.room_participants rp
  where rp.room_id = v_room.id;

  if v_count >= v_room.capacity then
    raise exception 'ROOM_FULL';
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

    if exists (
      select 1
      from public.room_participants rp
      where rp.room_id = v_room.id
        and rp.student_id = v_student.id
    ) then
      raise exception 'ALREADY_JOINED';
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

  else
    -- Ad-hoc room: guest join remains available.
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