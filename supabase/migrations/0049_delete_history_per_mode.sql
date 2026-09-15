-- 0049_delete_history_per_mode.sql
-- RPC hapus history per siswa per mode.

drop function if exists public.teacher_delete_student_history_by_mode(uuid, text);

create or replace function public.teacher_delete_student_history_by_mode(
  p_student_id uuid,
  p_mode text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_total int := 0;
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_mode not in ('competitive','cooperative','endless','practice','learning') then
    raise exception 'INVALID_MODE';
  end if;

  select s.class_id, c.teacher_id
    into v_class_id, v_teacher_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student_id;

  if v_teacher_id is null then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if v_teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  -- Room-based: hapus peserta di session yang game-nya mode ini
  if p_mode in ('competitive','cooperative','learning') then
    delete from public.room_session_participants rsp
    where rsp.student_id = p_student_id
      and exists (
        select 1
        from public.room_sessions rs
        join public.rooms r on r.id = rs.room_id
        join public.games g on g.id = r.game_id
        where rs.id = rsp.session_id and g.mode = p_mode
      );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  -- Practice: hapus jawaban siswa untuk game mode ini
  if p_mode in ('endless','practice') then
    delete from public.student_practice_answers spa
    where spa.student_id = p_student_id
      and exists (
        select 1 from public.games g
        where g.id = spa.game_id and g.mode = p_mode
      );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  return v_total;
end;
$$;

revoke all on function public.teacher_delete_student_history_by_mode(uuid, text) from public;
grant execute on function public.teacher_delete_student_history_by_mode(uuid, text) to authenticated;