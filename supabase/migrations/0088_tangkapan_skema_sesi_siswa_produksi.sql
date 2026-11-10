-- ============================================================================
-- 0088_tangkapan_skema_sesi_siswa_produksi.sql
-- Status: BERKAS TANGKAPAN (capture) — BUKAN untuk diterapkan ke produksi.
-- Objek-objek di berkas ini SUDAH ADA di basis data produksi; berkas ini
-- menuliskan definisinya persis seperti keadaan produksi pada 10 Nov 2026
-- supaya basis data dapat dibangun ulang dari repo (menutup sisi
-- dokumentasi/reproduksibilitas dari W1-M3, W3-M7, W7-M1 mega-audit).
-- Sumber: ekspor katalog produksi proyek zwenvfoolgwlcjprnxlk lewat SQL
-- Editor (pg_get_functiondef, information_schema, pg_policies, pg_indexes,
-- pg_constraint), 10 Nov 2026, baca-saja.
--
-- CATATAN KEASLIAN EKSPOR student_login: ekspor pertama (10 Nov 15:27
-- WITA) terbaca sebagai versi LAMA dua argumen (tanpa p_ip, kedaluwarsa
-- sesi 12 jam, kunci 1 menit, nilai kembali identitas tidak terisi,
-- sisipan sukses ganda). Ekspor ulang (15:41 WITA) dan peta tanda tangan
-- (15:36 WITA) membuktikan versi yang berlaku adalah TIGA argumen dan
-- jauh lebih baik: kunci 5 kali gagal dalam 5 menit, PIN diperiksa ke
-- SEMUA siswa bernama sama sampai cocok (tabrakan nama teratasi),
-- identitas kembali terisi, kedaluwarsa sesi 30 hari. Sebab bacaan
-- pertama berbeda tidak dapat dipastikan dari bukti yang ada; berkas
-- ini memuat versi ekspor ulang yang terverifikasi dua kali.
-- Satu catatan atas versi berlaku: student_login maupun
-- verify_student_session (diekspor ulang 15:43 WITA, sama persis
-- dengan bacaan pertama) TIDAK memeriksa is_active guru, jadi siswa
-- dari guru yang dinonaktifkan masih dapat masuk dan memakai sesi.
-- Tercatat sebagai sisa keputusan pemilik, belum diubah.
-- Keadaan keamanan yang tercatat: student_sessions dan login_attempts
-- ber-RLS nonaktif; student_sessions tidak mempunyai grant apa pun untuk
-- anon/authenticated (aman lewat fungsi SECURITY DEFINER), sedangkan
-- login_attempts mempunyai grant penuh untuk authenticated (diperbaiki
-- di 0089). class_materials ber-RLS aktif dengan satu policy guru.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabel: public.student_sessions (RLS nonaktif; tanpa policy)
-- ----------------------------------------------------------------------------
create table public.student_sessions (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_sessions_pkey primary key (id),
  constraint student_sessions_token_hash_key unique (token_hash)
);
create index student_sessions_expires_idx on public.student_sessions (expires_at);
create index student_sessions_student_idx on public.student_sessions (student_id);
-- Keadaan produksi: row level security NONAKTIF; tidak ada grant untuk
-- anon/authenticated (hanya postgres dan service_role).

-- ----------------------------------------------------------------------------
-- Tabel: public.login_attempts (RLS nonaktif; tanpa policy)
-- ----------------------------------------------------------------------------
create table public.login_attempts (
  id uuid not null default gen_random_uuid(),
  identifier text not null,
  success boolean not null,
  attempted_at timestamptz not null default now(),
  constraint login_attempts_pkey primary key (id)
);
create index login_attempts_identifier_time_idx
  on public.login_attempts (identifier, attempted_at desc);
-- Keadaan produksi saat ditangkap: row level security NONAKTIF dan grant
-- penuh (select/insert/update/delete/dll.) untuk role authenticated.
-- Diperbaiki oleh migrasi 0089.

-- ----------------------------------------------------------------------------
-- Tabel: public.class_materials (RLS aktif, 1 policy)
-- ----------------------------------------------------------------------------
create table public.class_materials (
  id uuid not null default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  content_json jsonb,
  youtube_url text,
  image_path text,
  pdf_path text,
  position integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_materials_pkey primary key (id),
  constraint class_materials_title_check
    check (char_length(btrim(title)) >= 1 and char_length(btrim(title)) <= 200)
);
create index class_materials_class_position_idx
  on public.class_materials (class_id, "position");
alter table public.class_materials enable row level security;
create policy class_materials_teacher_all on public.class_materials
  for all to authenticated
  using (exists (select 1 from public.classes c
                 where c.id = class_materials.class_id
                   and c.teacher_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c
                 where c.id = class_materials.class_id
                   and c.teacher_id = (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Fungsi sesi siswa (persis definisi produksi; grant: execute untuk anon,
-- authenticated, postgres pada ketiganya)
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.student_logout(p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
v_token text := btrim(coalesce(p_token, ''));
v_token_hash text;
begin
if v_token = '' then
 return;
end if;

v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

delete from public.student_sessions
where token_hash = v_token_hash;
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

update public.student_sessions
set last_seen_at = now()
where id = v_session_id;

return query
select v_student_id, v_name, v_class_id, v_class_name;
end;
$function$;

grant execute on function public.student_login(text, text, text) to anon, authenticated;
grant execute on function public.student_logout(text) to anon, authenticated;
grant execute on function public.verify_student_session(text) to anon, authenticated;
