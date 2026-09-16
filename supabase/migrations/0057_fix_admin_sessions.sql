-- 0057_fix_admin_sessions.sql
-- 1. admin_list_student_sessions: dedup per student (tampil 1 saja).
-- 2. admin_force_logout_student: hapus SEMUA session siswa itu (bukan 1).

drop function if exists public.admin_list_student_sessions();
drop function if exists public.admin_force_logout_student(uuid);

create or replace function public.admin_list_student_sessions()
returns table (
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
  select distinct on (ss.student_id)
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
  order by ss.student_id, ss.last_seen_at desc
  limit 200;
end;
$$;

create or replace function public.admin_force_logout_student(p_student_id uuid)
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

  delete from public.student_sessions where student_id = p_student_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.admin_list_student_sessions() from public;
grant execute on function public.admin_list_student_sessions() to authenticated;

revoke all on function public.admin_force_logout_student(uuid) from public;
grant execute on function public.admin_force_logout_student(uuid) to authenticated;