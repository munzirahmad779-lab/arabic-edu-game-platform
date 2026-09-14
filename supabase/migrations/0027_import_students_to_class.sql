-- 0027_import_students_to_class.sql
-- RPC batch untuk import siswa ke satu kelas sekaligus dari Excel.
-- Atomic: kalau ada 1 error, tidak ada yang tersimpan.
-- PIN di-hash dengan bcrypt (extensions.crypt + gen_salt('bf')).

create or replace function public.import_students_to_class(
  p_class_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_teacher_id uuid;
  v_row jsonb;
  v_index int := 0;
  v_name text;
  v_pin text;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select teacher_id into v_teacher_id
  from public.classes
  where id = p_class_id;

  if v_teacher_id is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 200 then
    raise exception 'INVALID_ROW_COUNT';
  end if;

  -- Validasi tiap baris
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_name := btrim(coalesce(v_row ->> 'name', ''));
    v_pin := btrim(coalesce(v_row ->> 'pin', ''));

    if v_name = '' or char_length(v_name) > 100 then
      raise exception 'INVALID_NAME:baris %', v_index;
    end if;

    if v_pin !~ '^[0-9]{4,6}$' then
      raise exception 'INVALID_PIN_FORMAT:baris %', v_index;
    end if;
  end loop;

  -- Cek duplikat di dalam file (nama sama case-insensitive)
  if exists (
    select 1
    from (
      select btrim(lower(item ->> 'name')) as n
      from jsonb_array_elements(p_rows) item
    ) t
    group by n
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_STUDENT_IN_FILE';
  end if;

  -- Cek duplikat dengan siswa yang sudah ada di kelas
  if exists (
    select 1
    from public.students s
    where s.class_id = p_class_id
      and lower(s.name) in (
        select lower(btrim(item ->> 'name'))
        from jsonb_array_elements(p_rows) item
      )
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  -- Insert semua
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_name := btrim(v_row ->> 'name');
    v_pin := btrim(v_row ->> 'pin');

    insert into public.students (class_id, name, pin_hash)
    values (
      p_class_id,
      v_name,
      extensions.crypt(v_pin, extensions.gen_salt('bf'))
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.import_students_to_class(uuid, jsonb) from public, anon;
grant execute on function public.import_students_to_class(uuid, jsonb) to authenticated;