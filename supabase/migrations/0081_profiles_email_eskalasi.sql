-- ============================================================================
-- GELOMBANG 2 — 0079_profiles_email_eskalasi.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026
-- lewat SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: sesuai harapan (lihat INDEKS gelombang 2).
-- Status: SIAP TERAP (menunggu persetujuan pemilik per berkas; berkas ini
-- hanya draf di folder gelombang2-draf, belum masuk supabase/migrations).
--
-- CATATAN PENOMORAN: nomor 0079 dan 0080 SUDAH dipakai migrasi asli di
-- supabase/migrations (0079_remove_guest_room_join.sql dan
-- 0080_projector_report_insert_policies.sql). Bila berkas ini dipindah ke
-- supabase/migrations, nomornya WAJIB diganti mengikuti INDEKS.md (0081).
--
-- Temuan yang ditutup:
-- - W1-K1 (Kritis, audit wilayah 1): eskalasi ke fungsi admin SQL lewat
--   pengubahan profiles.email milik sendiri.
-- - W7 Minor 4 (audit wilayah 7): email admin ditulis tetap di banyak
--   fungsi; literal disatukan ke satu fungsi pembantu di berkas ini.
--
-- Rantai celah (semua terbukti dari migrasi):
-- - 0002_rls_policies.sql:49-53: policy profiles_update_own mengizinkan
--   guru memperbarui kolom apa pun pada baris profilnya sendiri; with check
--   hanya (id = auth.uid()). Komentar di 0002:55-57 menyatakan pembaruan
--   email memang dibiarkan berjalan.
-- - 0001_init_schema.sql:74-90: trigger prevent_teacher_role_escalation
--   hanya menjaga kolom role; email tidak dijaga trigger mana pun.
-- - Fungsi admin memberi wewenang dengan membandingkan profiles.email
--   pemanggil (yang bisa diubah itu) ke literal super-admin:
--   0050_admin_panel.sql:31, 66, 88, 117, 152, 171 (enam fungsi),
--   0056_session_cleanup.sql:36, 0057_fix_admin_sessions.sql:25, 57.
--   Literal yang sama juga dipakai sebagai data: 0050:47 (pengecualian
--   super-admin dari daftar guru) dan 0050:72 (penjaga CANNOT_SELF).
--
-- Isi perubahan:
-- 1. Fungsi pembantu public.super_admin_email(): SATU-SATUNYA tempat
--    literal email super-admin ditulis sesudah migrasi ini.
-- 2. Fungsi pembantu public.is_super_admin(): wewenang dibaca dari klaim
--    email pada JWT pemanggil (auth.jwt()), BUKAN dari profiles.email.
--    Gagal-tertutup: konteks tanpa JWT menghasilkan false.
-- 3. Trigger baru trg_profiles_protect_email + fungsi
--    public.prevent_teacher_email_change(): menolak perubahan
--    profiles.email oleh pemanggil terautentikasi (auth.uid() not null),
--    meniru persis pola penjaga role di 0001:74-90. Pemanggil tanpa sesi
--    (service role / pemilik basis data) tidak dibatasi, sama seperti
--    penjaga role. Policy profiles_update_own TIDAK diubah: with check
--    RLS tidak dapat membandingkan baris lama dan baru, jadi trigger
--    adalah mekanisme yang benar untuk aturan "kolom tidak boleh berubah".
-- 4. Tujuh fungsi admin ditulis ulang dengan badan yang sama persis
--    seperti definisi terakhirnya, hanya pemeriksaan wewenangnya diganti
--    menjadi public.is_super_admin():
--    - admin_list_teachers()            (terakhir di 0050:13-51)
--    - admin_deactivate_teacher(uuid)   (terakhir di 0050:57-78)
--    - admin_activate_teacher(uuid)     (terakhir di 0050:80-98)
--    - admin_list_student_sessions()    (terakhir di 0057:8-44; versi
--      0050 sudah di-drop dan diganti 0057, jangan hidupkan kembali)
--    - admin_force_logout_student(uuid) (terakhir di 0057:46-68; tanda
--      tangan dan makna parameter mengikuti 0057: per siswa, returns int)
--    - admin_force_logout_all_students() (terakhir di 0050:164-186)
--    - admin_cleanup_expired_sessions() (terakhir di 0056:25-47)
--    Grant tiap fungsi diterbitkan ulang persis seperti aslinya
--    (0050 bagian Grants; 0056:49-50; 0057:70-74).
--
-- Risiko / efek samping:
-- - Guru tidak lagi bisa mengubah profiles.email lewat REST/PostgREST.
--   Tidak ada alur sah yang diketahui melakukan itu: formulir akun hanya
--   mengubah full_name (audit wilayah 1, src/app/dashboard/account/
--   actions.ts:27-29), dan tidak ada fungsi migrasi yang memperbarui
--   profiles.email (grep seluruh migrasi: 0 hasil di luar definisi ini).
-- - Bila email akun auth.users pemilik diganti lewat dasbor Supabase,
--   wewenang admin mengikuti email JWT yang baru (ini tujuannya), tetapi
--   profiles.email baris pemilik bisa tertinggal basi: admin_list_teachers
--   menampilkan profiles.email dan mengecualikan baris yang email
--   profilnya sama dengan super_admin_email(). Dampaknya hanya tampilan
--   daftar; samakan profiles.email pemilik secara manual (sebagai
--   pemilik basis data, trigger tidak menghalangi) bila itu terjadi.
-- - is_super_admin() membandingkan email JWT secara persis (peka huruf),
--   sama seperti pemeriksaan lama di 0050:31. Email di auth.users
--   disimpan Supabase dalam huruf kecil; gerbang aplikasi
--   (src/lib/super-admin.ts) menormalisasi huruf, jadi ada selisih
--   perilaku kecil yang disengaja demi konservatif. Belum terverifikasi
--   dari kode apakah ada akun pemilik dengan kapitalisasi berbeda.
--
-- Verifikasi sesudah diterapkan:
-- 1. Katalog:
--      select proname from pg_proc
--      where pronamespace = 'public'::regnamespace
--        and proname in ('super_admin_email', 'is_super_admin',
--                        'prevent_teacher_email_change');
--      select tgname from pg_trigger
--      where tgrelid = 'public.profiles'::regclass
--        and tgname = 'trg_profiles_protect_email';
-- 2. Uji negatif (sebagai guru non-admin, lewat REST dengan tokennya):
--    PATCH /rest/v1/profiles?id=eq.<uid sendiri> dengan
--    {"email": "<email super-admin>"} harus GAGAL dengan pesan
--    'profile email cannot be changed by the authenticated user'.
-- 3. Uji negatif: POST /rest/v1/rpc/admin_list_teachers dengan token
--    guru biasa harus error FORBIDDEN; dengan token pemilik harus
--    menjawab daftar guru seperti sebelumnya.
--
-- Rollback: terapkan ulang definisi dari 0050/0056/0057, lalu
-- drop trigger trg_profiles_protect_email, drop function
-- prevent_teacher_email_change, is_super_admin, super_admin_email.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fungsi pembantu: satu-satunya sumber literal super-admin
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_email()
returns text
language sql
immutable
as $$
  select 'munzirahmad779@gmail.com'::text;
$$;

revoke all on function public.super_admin_email() from public;
grant execute on function public.super_admin_email() to authenticated, service_role;

create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  -- Identitas diambil dari klaim JWT pemanggil, bukan dari tabel yang
  -- dapat diedit pengguna. Konteks tanpa JWT (SQL editor, cron) gagal
  -- tertutup: auth.jwt() bisa melempar galat bila tidak ada JWT pada
  -- permintaan, jadi dibungkus pengecualian dan hasilnya false.
  begin
    v_email := auth.jwt() ->> 'email';
  exception when others then
    v_email := null;
  end;
  return coalesce(v_email = public.super_admin_email(), false);
end;
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Penjaga kolom email pada profiles (meniru 0001:74-90 untuk role)
-- ----------------------------------------------------------------------------
create or replace function public.prevent_teacher_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'profile email cannot be changed by the authenticated user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_email on public.profiles;
create trigger trg_profiles_protect_email
  before update on public.profiles
  for each row execute function public.prevent_teacher_email_change();

-- ----------------------------------------------------------------------------
-- 3. admin_list_teachers (badan terakhir: 0050:13-51)
-- ----------------------------------------------------------------------------
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
begin
  if not public.is_super_admin() then
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
  where p.email <> public.super_admin_email()
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_teachers() from public;
grant execute on function public.admin_list_teachers() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. admin_deactivate_teacher (badan terakhir: 0050:57-78)
-- ----------------------------------------------------------------------------
create or replace function public.admin_deactivate_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_email text;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select p.email into v_target_email from public.profiles p where p.id = p_teacher_id;
  if v_target_email is null then raise exception 'NOT_FOUND'; end if;
  if v_target_email = public.super_admin_email() then raise exception 'CANNOT_SELF'; end if;

  update public.profiles set is_active = false where id = p_teacher_id;
end;
$$;

revoke all on function public.admin_deactivate_teacher(uuid) from public;
grant execute on function public.admin_deactivate_teacher(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. admin_activate_teacher (badan terakhir: 0050:80-98)
-- ----------------------------------------------------------------------------
create or replace function public.admin_activate_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles set is_active = true where id = p_teacher_id;
end;
$$;

revoke all on function public.admin_activate_teacher(uuid) from public;
grant execute on function public.admin_activate_teacher(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. admin_list_student_sessions (badan terakhir: 0057:8-44)
-- ----------------------------------------------------------------------------
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
begin
  if not public.is_super_admin() then
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

revoke all on function public.admin_list_student_sessions() from public;
grant execute on function public.admin_list_student_sessions() to authenticated;

-- ----------------------------------------------------------------------------
-- 7. admin_force_logout_student (badan terakhir: 0057:46-68)
-- ----------------------------------------------------------------------------
create or replace function public.admin_force_logout_student(p_student_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.student_sessions where student_id = p_student_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.admin_force_logout_student(uuid) from public;
grant execute on function public.admin_force_logout_student(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. admin_force_logout_all_students (badan terakhir: 0050:164-186)
-- ----------------------------------------------------------------------------
create or replace function public.admin_force_logout_all_students()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.student_sessions;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.admin_force_logout_all_students() from public;
grant execute on function public.admin_force_logout_all_students() to authenticated;

-- ----------------------------------------------------------------------------
-- 9. admin_cleanup_expired_sessions (badan terakhir: 0056:25-47)
-- ----------------------------------------------------------------------------
create or replace function public.admin_cleanup_expired_sessions()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_super_admin() then
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
