-- 0021_student_materials.sql
-- RPC untuk portal siswa: daftar & baca materi published di kelasnya.
-- Pakai SECURITY DEFINER supaya anon (siswa custom-session) bisa baca
-- tanpa perlu policy RLS khusus di class_materials.

create or replace function public.student_list_materials(
  p_token text,
  p_class_id uuid
)
returns table (
  id uuid,
  title text,
  "position" integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if v_class_id <> p_class_id then
    raise exception 'forbidden';
  end if;

  return query
    select m.id, m.title, m."position", m.updated_at
    from public.class_materials m
    where m.class_id = p_class_id
      and m.is_published = true
    order by m."position" asc, m.created_at asc;
end;
$$;

create or replace function public.student_get_material(
  p_token text,
  p_material_id uuid
)
returns table (
  id uuid,
  class_id uuid,
  title text,
  content_json jsonb,
  youtube_url text,
  image_path text,
  pdf_path text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  return query
    select m.id, m.class_id, m.title, m.content_json, m.youtube_url,
           m.image_path, m.pdf_path, m.updated_at
    from public.class_materials m
    where m.id = p_material_id
      and m.class_id = v_class_id
      and m.is_published = true;
end;
$$;

grant execute on function public.student_list_materials(text, uuid)
  to anon, authenticated;
grant execute on function public.student_get_material(text, uuid)
  to anon, authenticated;