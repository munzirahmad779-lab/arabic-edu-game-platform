-- =============================================================================
-- 0071_update_student.sql
-- Edit siswa (nama & PIN) untuk guru pemilik kelas.
--
-- Audit kode menemukan CRUD siswa tidak punya fungsi ubah: hanya
-- create_student, reset_student_pin, dan delete_student (0019). RPC ini
-- menutup celah itu dengan pola yang sama persis seperti 0019:
-- SECURITY DEFINER, pemilik diverifikasi lewat classes.teacher_id,
-- validasi nama sama seperti create_student, PIN bcrypt (crypt/gen_salt).
--
-- p_pin NULL atau string kosong berarti PIN TIDAK diubah (guru hanya
-- mengganti nama). Bila PIN diisi, pin_hash dan pin_plain diperbarui
-- bersamaan, selaras dengan perilaku reset_student_pin + kartu cetak.
-- =============================================================================

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
      pin_hash = crypt(v_pin, gen_salt('bf')),
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

revoke all on function public.update_student(uuid, text, text) from public, anon;
grant execute on function public.update_student(uuid, text, text) to authenticated;
