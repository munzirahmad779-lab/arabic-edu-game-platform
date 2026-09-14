-- 0028_import_students_simple.sql
-- 1. Tambah kolom pin_plain supaya guru bisa lihat PIN siswa.
-- 2. Ganti RPC import_students_to_class: terima array nama, PIN auto
--    generate berurutan mulai 1001.

alter table public.students
  add column if not exists pin_plain text;

drop function if exists public.import_students_to_class(uuid, jsonb);

create or replace function public.import_students_to_class(
  p_class_id uuid,
  p_names jsonb
)
returns table (student_name text, student_pin text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_teacher_id uuid;
  v_name text;
  v_index int := 0;
  v_total int;
  v_existing int;
  v_start_pin int;
  v_pin text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select c.teacher_id into v_teacher_id
  from public.classes c where c.id = p_class_id;

  if v_teacher_id is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  if jsonb_typeof(p_names) <> 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  v_total := jsonb_array_length(p_names);
  if v_total < 1 or v_total > 200 then
    raise exception 'INVALID_ROW_COUNT';
  end if;

  v_index := 0;
  for v_name in select jsonb_array_elements_text(p_names) loop
    v_index := v_index + 1;
    v_name := btrim(v_name);
    if v_name = '' or char_length(v_name) > 100 then
      raise exception 'INVALID_NAME:baris %', v_index;
    end if;
  end loop;

  if exists (
    select 1 from (
      select btrim(lower(value::text)) as n
      from jsonb_array_elements_text(p_names) as value
    ) t
    group by n having count(*) > 1
  ) then
    raise exception 'DUPLICATE_STUDENT_IN_FILE';
  end if;

  if exists (
    select 1 from public.students s
    where s.class_id = p_class_id
      and lower(s.name) in (
        select lower(btrim(value::text))
        from jsonb_array_elements_text(p_names) as value
      )
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  select count(*) into v_existing
  from public.students where class_id = p_class_id;

  v_start_pin := 1001 + v_existing;

  v_index := 0;
  for v_name in select jsonb_array_elements_text(p_names) loop
    v_index := v_index + 1;
    v_name := btrim(v_name);
    v_pin := (v_start_pin + v_index - 1)::text;

    insert into public.students (class_id, name, pin_hash, pin_plain)
    values (
      p_class_id,
      v_name,
      extensions.crypt(v_pin, extensions.gen_salt('bf')),
      v_pin
    );

    student_name := v_name;
    student_pin := v_pin;
    return next;
  end loop;
end;
$$;

revoke all on function public.import_students_to_class(uuid, jsonb) from public, anon;
grant execute on function public.import_students_to_class(uuid, jsonb) to authenticated;