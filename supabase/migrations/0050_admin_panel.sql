-- 0050_admin_panel.sql
-- Admin panel untuk super admin (munzirahmad779@gmail.com).
-- 1. Kolom is_active di profiles.
-- 2. RPC list/nonaktifkan/aktifkan guru.
-- 3. RPC list/force-logout session siswa.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- ============================================================
-- LIST TEACHERS (selain super admin)
-- ============================================================
create or replace function public.admin_list_teachers()
returns table (
  id uuid,
  email text,
  full_name text,
  is_active boolean,
  created_at timestamptz,
  class_count int,
  student_count int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select p.email into v_email from public.profiles p where p.id = auth.uid();
  if v_email is null or v_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.is_active,
    p.created_at,
    (select count(*)::int from public.classes c where c.teacher_id = p.id),
    (select count(*)::int from public.students s
      join public.classes c on c.id = s.class_id
      where c.teacher_id = p.id)
  from public.profiles p
  where p.email <> 'munzirahmad779@gmail.com'
  order by p.created_at desc;
end;
$$;

-- ============================================================
-- DEACTIVATE / ACTIVATE TEACHER
-- ============================================================
create or replace function public.admin_deactivate_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_email text;
  v_target_email text;
begin
  select p.email into v_my_email from public.profiles p where p.id = auth.uid();
  if v_my_email is null or v_my_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  select p.email into v_target_email from public.profiles p where p.id = p_teacher_id;
  if v_target_email is null then raise exception 'NOT_FOUND'; end if;
  if v_target_email = 'munzirahmad779@gmail.com' then raise exception 'CANNOT_SELF'; end if;

  update public.profiles set is_active = false where id = p_teacher_id;
end;
$$;

create or replace function public.admin_activate_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_email text;
begin
  select p.email into v_my_email from public.profiles p where p.id = auth.uid();
  if v_my_email is null or v_my_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles set is_active = true where id = p_teacher_id;
end;
$$;

-- ============================================================
-- LIST STUDENT SESSIONS (yang masih valid)
-- ============================================================
create or replace function public.admin_list_student_sessions()
returns table (
  session_id uuid,
  student_id uuid,
  student_name text,
  class_name text,
  expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select p.email into v_email from public.profiles p where p.id = auth.uid();
  if v_email is null or v_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    ss.id,
    ss.student_id,
    s.name,
    c.name,
    ss.expires_at,
    ss.last_seen_at,
    ss.created_at
  from public.student_sessions ss
  join public.students s on s.id = ss.student_id
  join public.classes c on c.id = s.class_id
  where ss.expires_at > now()
  order by ss.last_seen_at desc
  limit 200;
end;
$$;

-- ============================================================
-- FORCE LOGOUT
-- ============================================================
create or replace function public.admin_force_logout_student(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select p.email into v_email from public.profiles p where p.id = auth.uid();
  if v_email is null or v_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.student_sessions where id = p_session_id;
end;
$$;

create or replace function public.admin_force_logout_all_students()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_n int;
begin
  select p.email into v_email from public.profiles p where p.id = auth.uid();
  if v_email is null or v_email <> 'munzirahmad779@gmail.com' then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.student_sessions;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Grants
revoke all on function public.admin_list_teachers() from public;
grant execute on function public.admin_list_teachers() to authenticated;

revoke all on function public.admin_deactivate_teacher(uuid) from public;
grant execute on function public.admin_deactivate_teacher(uuid) to authenticated;

revoke all on function public.admin_activate_teacher(uuid) from public;
grant execute on function public.admin_activate_teacher(uuid) to authenticated;

revoke all on function public.admin_list_student_sessions() from public;
grant execute on function public.admin_list_student_sessions() to authenticated;

revoke all on function public.admin_force_logout_student(uuid) from public;
grant execute on function public.admin_force_logout_student(uuid) to authenticated;

revoke all on function public.admin_force_logout_all_students() from public;
grant execute on function public.admin_force_logout_all_students() to authenticated;