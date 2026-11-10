-- ============================================================================
-- 0097_gerbang_guru_aktif_login_siswa.sql
-- Penutup sisa keputusan pemilik dari tangkapan skema 0088: student_login
-- dan verify_student_session TIDAK memeriksa is_active guru, jadi siswa
-- dari guru yang dinonaktifkan admin tetap dapat masuk dan memakai sesi
-- (kepala berkas 0088 mencatatnya sebagai "sisa keputusan pemilik, belum
-- diubah"; audit live 10 Nov 2026 mengangkatnya lagi dan pemilik meminta
-- gerbang ini ditutup).
--
-- Isi perubahan: kedua fungsi ditulis ulang PERSIS seperti definisi
-- produksi pada tangkapan 0088, dengan SATU tambahan pada masing-masing
-- fungsi: sesudah siswa/sesi ditemukan, periksa guru pemilik kelasnya
-- (classes.teacher_id -> profiles.is_active, kolom dari migrasi 0050).
-- Bila guru nonaktif (atau profilnya tidak ada), hasilnya diperlakukan
-- persis seperti kredensial tidak cocok:
-- - student_login menaikkan INVALID_CREDENTIALS yang sama seperti PIN
--   salah, dan mencatat satu percobaan gagal di login_attempts seperti
--   jalur PIN salah, supaya tidak ada petunjuk bahwa sebabnya adalah
--   guru nonaktif dan laju percobaan tetap terhitung ke kunci 5 kali.
-- - verify_student_session menaikkan INVALID_SESSION, satu-satunya
--   galat sesi yang memang dipakai fungsi itu.
-- Tidak ada perubahan perilaku lain: kunci 5 gagal/5 menit, pemeriksaan
-- PIN ke semua siswa bernama sama, token sesi 30 hari, dan grant tidak
-- berubah.
--
-- Verifikasi sesudah penerapan:
-- 1. Katalog: pg_get_functiondef untuk kedua fungsi memuat
--    "profiles" dan "is_active".
-- 2. Live: nonaktifkan satu guru uji dari panel admin, lalu coba masuk
--    sebagai siswanya dengan PIN yang BENAR: hasilnya wajib galat
--    kredensial generik yang sama seperti PIN salah. Sesi siswa yang
--    sudah terbit dari guru itu juga wajib ditolak verify (portal siswa
--    meminta masuk ulang). Aktifkan kembali gurunya: siswa yang sama
--    dapat masuk lagi.
--
-- Rollback: terapkan ulang definisi kedua fungsi dari tangkapan 0088.
--
-- CATATAN: berkas ini ditulis pada paket perbaikan 10 Nov 2026 dan
-- BELUM diterapkan ke basis data; penerapan menunggu persetujuan
-- pemilik per berkas seperti biasa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.student_login(p_name text, p_pin text, p_ip text)
 RETURNS TABLE(token text, student_id uuid, student_name text, student_class_id uuid, class_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_name text := btrim(coalesce(p_name, ''));
 v_pin text := btrim(coalesce(p_pin, ''));
 v_identifier text := lower(v_name);
 v_ip text := nullif(btrim(coalesce(p_ip, '')), '');
 v_failed_attempts int;
 v_student_id uuid;
 v_student_name text;
 v_student_class_id uuid;
 v_class_name text;
 v_token text;
 v_token_hash text;
begin
 if v_name = '' or v_pin = '' then
  raise exception 'MISSING_CREDENTIALS';
 end if;

 select count(*)::int into v_failed_attempts
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
  select s.id, s.name, s.class_id, s.pin_hash, c.name as class_name
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
   exit;
  end if;
 end loop;

 if v_student_id is null then
  insert into public.login_attempts (identifier, success)
  values (v_identifier, false);
  raise exception 'INVALID_CREDENTIALS';
 end if;

 -- Gerbang guru aktif (tambahan 0097): siswa dari guru yang
 -- dinonaktifkan tidak dapat masuk; diperlakukan persis seperti
 -- kredensial tidak cocok, tanpa membocorkan sebabnya.
 if not exists (
  select 1
  from public.classes c
  join public.profiles p on p.id = c.teacher_id
  where c.id = v_student_class_id
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

CREATE OR REPLACE FUNCTION public.verify_student_session(p_token text)
 RETURNS TABLE(student_id uuid, name text, class_id uuid, class_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
v_token text := btrim(coalesce(p_token, ''));
v_token_hash text;
v_session_id uuid;
v_student_id uuid;
v_name text;
v_class_id uuid;
v_class_name text;
begin
if v_token = '' then
 raise exception 'INVALID_SESSION';
end if;

v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

select ss.id, s.id, s.name, s.class_id, c.name
into v_session_id, v_student_id, v_name, v_class_id, v_class_name
from public.student_sessions ss
join public.students s on s.id = ss.student_id
join public.classes c on c.id = s.class_id
where ss.token_hash = v_token_hash
 and ss.expires_at > now()
limit 1;

if not found then
 raise exception 'INVALID_SESSION';
end if;

-- Gerbang guru aktif (tambahan 0097): sesi yang sudah terbit pun
-- berhenti berlaku begitu guru pemilik kelas dinonaktifkan.
if not exists (
 select 1
 from public.classes c
 join public.profiles p on p.id = c.teacher_id
 where c.id = v_class_id
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
