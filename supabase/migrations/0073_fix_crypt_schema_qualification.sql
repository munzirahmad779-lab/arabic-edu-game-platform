-- 0073_fix_crypt_schema_qualification.sql
-- Perbaikan regresi live 29 Okt 2026: sesudah migrasi gabungan 0068-0072
-- dijalankan di produksi, gabung room siswa gagal dengan error
-- "function crypt(text, text) does not exist". join_room (0068) dan
-- update_student (0071) memanggil crypt()/gen_salt() tanpa kualifikasi
-- skema di dalam fungsi ber-search_path '', sedangkan pgcrypto di
-- Supabase tinggal di skema extensions. Migrasi ini membuat ulang KEDUA
-- fungsi itu dengan isi PERSIS sama, hanya panggilan crypt/gen_salt
-- yang dikualifikasi extensions. Tidak ada perubahan perilaku lain.

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

    if extensions.crypt(v_pin, v_student.pin_hash) <> v_student.pin_hash then
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

create or replace function public.update_student(
  p_student_id uuid,
  p_name text,
  p_pin text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_pin text := btrim(coalesce(p_pin, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  if v_pin <> '' and v_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN_FORMAT';
  end if;

  select s.class_id
    into v_class_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student_id
    and c.teacher_id = (select auth.uid());

  if v_class_id is null then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.students s
    where s.class_id = v_class_id
      and s.id <> p_student_id
      and lower(btrim(s.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  if v_pin <> '' then
    update public.students
    set
      name = v_name,
      pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
      pin_plain = v_pin,
      updated_at = now()
    where id = p_student_id;
  else
    update public.students
    set
      name = v_name,
      updated_at = now()
    where id = p_student_id;
  end if;

  return true;
end;
$$;
