-- 0056_session_cleanup.sql
-- 1. Trigger: auto-hapus session lama saat siswa login baru (1 siswa = 1 session).
-- 2. RPC: hapus session kadaluarsa manual dari admin.

create or replace function public.cleanup_sessions_on_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.student_sessions
  where student_id = NEW.student_id
    and id <> NEW.id;
  return NEW;
end;
$$;

drop trigger if exists trg_cleanup_sessions_on_login on public.student_sessions;
create trigger trg_cleanup_sessions_on_login
  after insert on public.student_sessions
  for each row
  execute function public.cleanup_sessions_on_login();

create or replace function public.admin_cleanup_expired_sessions()
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

  delete from public.student_sessions
  where expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.admin_cleanup_expired_sessions() from public;
grant execute on function public.admin_cleanup_expired_sessions() to authenticated;