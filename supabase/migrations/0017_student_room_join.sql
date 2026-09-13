-- 0017_student_room_join.sql
create extension if not exists pgcrypto;

alter table public.room_participants
  add column if not exists join_token uuid not null default gen_random_uuid();

create unique index if not exists uq_room_participants_join_token
  on public.room_participants(join_token);

revoke all on table public.room_participants from anon;
grant select, insert, update, delete on table public.room_participants to authenticated;

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
  if v_code = '' or char_length(v_code) <> 6 then raise exception 'INVALID_ROOM_CODE'; end if;
  if v_name = '' or char_length(v_name) > 100 then raise exception 'INVALID_NAME'; end if;

  select * into v_room from public.rooms where upper(code) = v_code limit 1 for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.state <> 'waiting' then raise exception 'ROOM_NOT_OPEN'; end if;

  select count(*)::integer into v_count from public.room_participants rp where rp.room_id = v_room.id;
  if v_count >= v_room.capacity then raise exception 'ROOM_FULL'; end if;

  if v_room.class_id is not null and v_pin <> '' then
    select s.* into v_student
    from public.students s
    where s.class_id = v_room.class_id
      and lower(btrim(s.name)) = lower(v_name)
    limit 1;

    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
    if crypt(v_pin, v_student.pin_hash) <> v_student.pin_hash then raise exception 'INVALID_PIN'; end if;

    if exists (select 1 from public.room_participants rp where rp.room_id = v_room.id and rp.student_id = v_student.id) then
      raise exception 'ALREADY_JOINED';
    end if;

    insert into public.room_participants (room_id, student_id, connection_state, join_token)
    values (v_room.id, v_student.id, 'connected', gen_random_uuid())
    returning * into v_participant;
  else
    insert into public.room_participants (room_id, guest_name, connection_state, join_token)
    values (v_room.id, v_name, 'connected', gen_random_uuid())
    returning * into v_participant;
  end if;

  select count(*)::integer into v_count from public.room_participants rp where rp.room_id = v_room.id;

  return query
  select v_room.id, v_room.code,
         coalesce(v_room.snapshot->'game'->>'name', 'لعبة'),
         v_room.class_id, v_participant.id,
         coalesce(v_student.name, v_participant.guest_name),
         v_participant.join_token, v_count, v_room.capacity;
end;
$$;

revoke all on function public.join_room(text, text, text) from public;
grant execute on function public.join_room(text, text, text) to anon, authenticated;

create or replace function public.get_join_session(p_join_token uuid)
returns table (
  room_id uuid, room_code text, game_name text, room_state text,
  participant_id uuid, participant_name text, participant_count integer, capacity integer
)
language sql security definer set search_path = ''
as $$
  select r.id, r.code, coalesce(r.snapshot->'game'->>'name', 'لعبة'), r.state,
         rp.id, coalesce(s.name, rp.guest_name),
         (select count(*)::integer from public.room_participants all_rp where all_rp.room_id = r.id),
         r.capacity
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  left join public.students s on s.id = rp.student_id
  where rp.join_token = p_join_token;
$$;
revoke all on function public.get_join_session(uuid) from public;
grant execute on function public.get_join_session(uuid) to anon, authenticated;
