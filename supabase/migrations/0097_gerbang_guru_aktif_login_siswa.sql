-- ============================================================================
-- 0097_gerbang_guru_aktif_login_siswa.sql
-- Gerbang guru aktif pada login siswa (menutup sisa keputusan pemilik
-- dari gelombang 2; perintah perbaikan menyeluruh user 10 Nov 2026).
--
-- Masalah: siswa milik guru yang dinonaktifkan (profiles.is_active =
-- false, migrasi 0050) tetap bisa masuk dan memakai sesi, karena
-- student_login dan verify_student_session tidak pernah memeriksa
-- status guru pemilik kelas.
--
-- Badan kedua fungsi di berkas ini PERSIS definisi live produksi
-- yang diekspor ulang 10 Nov 2026 (tahap 28), termasuk RETURNS TABLE
-- (token, student_id, name, class_id, class_name), pengenal kunci
-- nama+IP, dan tanpa MISSING_CREDENTIALS. Satu-satunya tambahan:
-- 1. student_login: sesudah PIN cocok dan siswa ditemukan, periksa
--    guru pemilik kelas aktif. Bila nonaktif atau profil hilang:
--    catat satu percobaan gagal (pengenal yang sama) lalu naikkan
--    INVALID_CREDENTIALS yang identik dengan jalur PIN salah, tanpa
--    membocorkan sebab, dan tetap terhitung ke kunci 5 kali.
-- 2. verify_student_session: sesudah sesi ditemukan, periksa guru
--    pemilik kelas aktif; bila nonaktif naikkan INVALID_SESSION.
--
-- Percobaan penerapan pertama (berbasis tangkapan 0088) gagal 42P13
-- karena tangkapan itu basi pada nama kolom RETURNS TABLE; berkas
-- ini sudah disamakan dengan definisi live.
--
-- Verifikasi sesudah penerapan:
-- 1. Katalog: pg_get_functiondef kedua fungsi memuat "is_active".
-- 2. Live: login siswa guru aktif tetap berhasil.
--
-- Rollback: terapkan ulang definisi live tahap 28 (tanpa gerbang).
-- ============================================================================

create or replace function public.student_login(
  p_name text,
  p_pin text,
  p_ip text
)
returns table (
  token text,
  student_id uuid,
  name text,
  class_id uuid,
  class_name text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_pin text := btrim(coalesce(p_pin, ''));
  v_ip text := nullif(btrim(coalesce(p_ip, '')), '');
  v_identifier text;
  v_failed_attempts integer;
  v_student_id uuid;
  v_student_name text;
  v_student_class_id uuid;
  v_class_name text;
  v_teacher_id uuid;
  v_token text;
  v_token_hash text;
  r record;
begin
  v_identifier := lower(v_name) || ':' || coalesce(v_ip, 'unknown');

  select count(*)::integer into v_failed_attempts
  from public.login_attempts la
  where la.identifier = v_identifier
    and la.success = false
    and la.attempted_at >= now() - interval '5 minutes';

  if v_failed_attempts >= 5 then
    raise exception 'TOO_MANY_ATTEMPTS';
  end if;

  if v_name = ''
    or char_length(v_name) > 100
    or v_pin !~ '^[0-9]{4,6}$' then
    insert into public.login_attempts (identifier, success)
    values (v_identifier, false);
    raise exception 'INVALID_CREDENTIALS';
  end if;

  -- Nama bisa dipakai lebih dari satu siswa: periksa PIN ke semua
  -- siswa bernama sama, pakai yang PIN-nya cocok.
  v_student_id := null;
  for r in
    select s.id, s.name, s.class_id, s.pin_hash, c.name as class_name, c.teacher_id
    from public.students s
    join public.classes c on c.id = s.class_id
    where lower(btrim(s.name)) = lower(v_name)
    order by s.created_at asc
  loop
    if extensions.crypt(v_pin, r.pin_hash) = r.pin_hash then
      v_student_id := r.id;
      v_student_name := r.name;
      v_student_class_id := r.class_id;
      v_class_name := r.class_name;
      v_teacher_id := r.teacher_id;
      exit;
    end if;
  end loop;

  if v_student_id is null then
    insert into public.login_attempts (identifier, success)
    values (v_identifier, false);
    raise exception 'INVALID_CREDENTIALS';
  end if;

  -- Gerbang 0097: guru pemilik kelas wajib aktif.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.is_active = true
  ) then
    insert into public.login_attempts (identifier, success)
    values (v_identifier, false);
    raise exception 'INVALID_CREDENTIALS';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.student_sessions (student_id, token_hash, expires_at)
  values (v_student_id, v_token_hash, now() + interval '30 days');

  insert into public.login_attempts (identifier, success)
  values (v_identifier, true);

  return query
  select v_token, v_student_id, v_student_name, v_student_class_id, v_class_name;
end;
$function$;

create or replace function public.verify_student_session(
  p_token text
)
returns table (
  student_id uuid,
  name text,
  class_id uuid,
  class_name text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_token_hash text;
  v_session_id uuid;
  v_student_id uuid;
  v_name text;
  v_class_id uuid;
  v_class_name text;
  v_teacher_id uuid;
begin
  if v_token = '' then
    raise exception 'INVALID_SESSION';
  end if;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select ss.id, s.id, s.name, s.class_id, c.name, c.teacher_id
  into v_session_id, v_student_id, v_name, v_class_id, v_class_name, v_teacher_id
  from public.student_sessions ss
  join public.students s on s.id = ss.student_id
  join public.classes c on c.id = s.class_id
  where ss.token_hash = v_token_hash
    and ss.expires_at > now()
  limit 1;

  if not found then
    raise exception 'INVALID_SESSION';
  end if;

  -- Gerbang 0097: guru pemilik kelas wajib aktif.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.is_active = true
  ) then
    raise exception 'INVALID_SESSION';
  end if;

  update public.student_sessions
  set last_seen_at = now()
  where id = v_session_id;

  return query
  select v_student_id, v_name, v_class_id, v_class_name;
end;
$function$;

grant execute on function public.student_login(text, text, text) to anon, authenticated;
grant execute on function public.verify_student_session(text) to anon, authenticated;
